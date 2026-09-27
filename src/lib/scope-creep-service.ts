/**
 * Agent-009 (Scope Creep Detection) service — Phase 6 Step 6.04 (ADR-034).
 *
 * Session-independent and project-scoped: invoked by the `pulse-agent` container
 * through `POST /api/internal/agent/scope-creep-check`. Deterministic, zero LLM tokens.
 */
import type { UserNotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { shouldDeliverWithPreferences } from "@/lib/notification-logic";
import { getStartOfCalendarDay, resolvePmName } from "@/lib/deadline-tracker-logic";
import { logActivity } from "@/lib/activity-logger";
import { createNotification } from "@/actions/notification";
import {
  calculateScopeCreep,
  buildScopeCreepNotification,
  DEFAULT_SCOPE_CREEP_THRESHOLD_PERCENT,
  type ScopeCreepSprintTaskInput,
} from "@/lib/scope-creep-logic";

export const SCOPE_CREEP_AGENT_KEY = "agent-009";

export interface ScopeCreepCheckResult {
  sprintChecked: boolean;
  injectedTaskCount: number;
  growthRatePercent: number;
  thresholdExceeded: boolean;
  notificationSent: boolean;
}

const EMPTY_RESULT: ScopeCreepCheckResult = {
  sprintChecked: false,
  injectedTaskCount: 0,
  growthRatePercent: 0,
  thresholdExceeded: false,
  notificationSent: false,
};

export async function dispatchScopeCreepCheck(
  projectId: string,
  now: Date = getNow(),
): Promise<ScopeCreepCheckResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: SCOPE_CREEP_AGENT_KEY },
        include: { pmUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const agentSetting = project.agentSettings[0];
  if (agentSetting && !agentSetting.enabled) {
    return { ...EMPTY_RESULT };
  }

  const sprint = await prisma.sprint.findFirst({
    where: { projectId, status: "ACTIVE" },
    select: { id: true, name: true, startDate: true },
  });

  if (!sprint) {
    return { ...EMPTY_RESULT };
  }

  const sprintTaskRows = await prisma.sprintTask.findMany({
    where: { sprintId: sprint.id },
    select: { taskId: true, addedAt: true },
  });

  const sprintTasks: ScopeCreepSprintTaskInput[] = sprintTaskRows.map((row) => ({
    taskId: row.taskId,
    addedAt: row.addedAt,
  }));

  const configThreshold = (agentSetting?.config as { scopeCreepThreshold?: number } | null)
    ?.scopeCreepThreshold;
  const thresholdPercent =
    typeof configThreshold === "number" ? configThreshold : DEFAULT_SCOPE_CREEP_THRESHOLD_PERCENT;

  const result = calculateScopeCreep(sprint, sprintTasks, now, thresholdPercent);

  if (!result.exceededThreshold) {
    return {
      sprintChecked: true,
      injectedTaskCount: result.injectedTaskCount,
      growthRatePercent: result.growthRatePercent,
      thresholdExceeded: false,
      notificationSent: false,
    };
  }

  const adminUsers = project.members.map((member) => member.user);
  const recipients = new Map<string, { id: string; name: string | null }>();
  for (const admin of adminUsers) {
    recipients.set(admin.id, admin);
  }
  if (agentSetting?.pmUser) {
    recipients.set(agentSetting.pmUser.id, agentSetting.pmUser);
  }
  const recipientIds = [...recipients.keys()];

  const startOfToday = getStartOfCalendarDay(now);
  const alreadySentToday = await prisma.notification.findFirst({
    where: {
      userId: { in: recipientIds },
      title: { contains: "Kapsam Kayması" },
      createdAt: { gte: startOfToday },
    },
  });

  if (alreadySentToday) {
    return {
      sprintChecked: true,
      injectedTaskCount: result.injectedTaskCount,
      growthRatePercent: result.growthRatePercent,
      thresholdExceeded: true,
      notificationSent: false,
    };
  }

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
  const notif = buildScopeCreepNotification({
    pmName,
    sprintName: sprint.name,
    injectedTaskCount: result.injectedTaskCount,
    growthRatePercent: result.growthRatePercent,
  });
  const link = `/projects/${projectId}/sprints`;

  const preferenceCache = new Map<string, UserNotificationPreference | null>();
  const getPreferences = async (userId: string) => {
    if (!preferenceCache.has(userId)) {
      preferenceCache.set(
        userId,
        await prisma.userNotificationPreference.findUnique({ where: { userId } }),
      );
    }
    return preferenceCache.get(userId) ?? null;
  };

  for (const recipientId of recipientIds) {
    const preferences = await getPreferences(recipientId);
    if (
      !shouldDeliverWithPreferences({
        actorId: null,
        recipientId,
        type: "TASK_MENTIONED",
        preferences,
      })
    ) {
      continue;
    }

    await createNotification({
      type: "TASK_MENTIONED",
      title: notif.title,
      message: notif.message,
      link,
      actorId: null,
      userId: recipientId,
    });
  }

  // Activity.taskId is required and there is no sprint-level activity concept in the schema,
  // so we anchor the log entry to the first injected task as a representative reference.
  if (result.injectedTaskIds.length > 0) {
    const actorId = agentSetting?.pmUser?.id ?? project.owner.id;
    await logActivity(prisma, {
      type: "SPRINT_UPDATED",
      taskId: result.injectedTaskIds[0],
      actorId,
      isAiGenerated: true,
      metadata: {
        sprintId: sprint.id,
        sprintName: sprint.name,
        injectedTaskCount: result.injectedTaskCount,
        growthRatePercent: result.growthRatePercent,
      },
    });
  }

  return {
    sprintChecked: true,
    injectedTaskCount: result.injectedTaskCount,
    growthRatePercent: result.growthRatePercent,
    thresholdExceeded: true,
    notificationSent: true,
  };
}
