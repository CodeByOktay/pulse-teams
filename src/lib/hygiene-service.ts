/**
 * Agent-002 (Task Hygiene) service — Phase 6 Step 6.03 (ADR-034).
 *
 * Session-independent and project-scoped: invoked by the `pulse-agent` container
 * through `POST /api/internal/agent/hygiene-check`. Deterministic, zero LLM tokens.
 */
import type { Prisma, UserNotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { shouldDeliverWithPreferences } from "@/lib/notification-logic";
import { getStartOfCalendarDay, resolvePmName } from "@/lib/deadline-tracker-logic";
import { buildHygieneReportNotification, summarizeHygiene, type HygieneTaskInput } from "@/lib/hygiene-logic";

export const TASK_HYGIENE_AGENT_KEY = "agent-002";

export interface HygieneCheckResult {
  tasksScanned: number;
  defectiveTasks: number;
  reportSent: boolean;
}

export async function dispatchTaskHygieneReport(
  projectId: string,
  now: Date = getNow(),
): Promise<HygieneCheckResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: TASK_HYGIENE_AGENT_KEY },
        include: { pmUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const agentSetting = project.agentSettings[0];
  if (agentSetting && !agentSetting.enabled) {
    return { tasksScanned: 0, defectiveTasks: 0, reportSent: false };
  }

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
  const adminUsers = project.members.map((member) => member.user);

  const activeTasks = await prisma.task.findMany({
    where: {
      projectId,
      state: { group: { notIn: ["DONE", "CANCELLED"] } },
    },
    include: {
      assignees: true,
      state: { select: { group: true } },
    },
  });

  const hygieneTasks: HygieneTaskInput[] = activeTasks.map((task) => ({
    id: task.id,
    stateGroup: task.state.group,
    assigneeCount: task.assignees.length,
    dueDate: task.dueDate,
    description: task.description,
  }));

  const summary = summarizeHygiene(hygieneTasks);

  if (summary.total === 0) {
    return { tasksScanned: hygieneTasks.length, defectiveTasks: 0, reportSent: false };
  }

  const startOfToday = getStartOfCalendarDay(now);
  const adminIds = adminUsers.map((admin) => admin.id);

  const alreadySentToday = await prisma.notification.findFirst({
    where: {
      userId: { in: adminIds },
      title: { contains: "Görev Hijyeni Raporu" },
      createdAt: { gte: startOfToday },
    },
  });

  if (alreadySentToday) {
    return { tasksScanned: hygieneTasks.length, defectiveTasks: summary.total, reportSent: false };
  }

  const report = buildHygieneReportNotification({ pmName, summary, projectId });
  if (!report) {
    return { tasksScanned: hygieneTasks.length, defectiveTasks: summary.total, reportSent: false };
  }

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

  const notificationsToCreate: Prisma.NotificationCreateManyInput[] = [];

  for (const admin of adminUsers) {
    const preferences = await getPreferences(admin.id);
    if (
      !shouldDeliverWithPreferences({
        actorId: null,
        recipientId: admin.id,
        type: "TASK_MENTIONED",
        preferences,
      })
    ) {
      continue;
    }

    notificationsToCreate.push({
      type: "TASK_MENTIONED",
      title: report.title,
      message: report.message,
      link: report.link,
      userId: admin.id,
      actorId: null,
    });
  }

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({ data: notificationsToCreate });
  }

  return { tasksScanned: hygieneTasks.length, defectiveTasks: summary.total, reportSent: true };
}
