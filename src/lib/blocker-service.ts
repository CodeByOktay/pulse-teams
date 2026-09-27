/**
 * Agent-004 (Blocker Manager) service — Phase 6 Step 6.04 (ADR-034).
 *
 * Session-independent and project-scoped: invoked by the `pulse-agent` container
 * through `POST /api/internal/agent/blocker-check`. Deterministic, zero LLM tokens.
 */
import type { UserNotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { shouldDeliverWithPreferences, buildNotificationDeepLink } from "@/lib/notification-logic";
import { getStartOfCalendarDay, resolvePmName } from "@/lib/deadline-tracker-logic";
import { formatTaskIdentifier } from "@/lib/relation-logic";
import { logActivity } from "@/lib/activity-logger";
import { formatUnblockedNotificationMessage } from "@/lib/automation-logic";
import { createNotification } from "@/actions/notification";
import {
  analyzeBlockerChain,
  buildBlockerNotification,
  isFullyUnblocked,
  type BlockerFinding,
  type BlockerRelationInput,
  type BlockerTaskInput,
  type BlockerTaskRef,
} from "@/lib/blocker-logic";

export const BLOCKER_MANAGER_AGENT_KEY = "agent-004";

export interface BlockerCheckResult {
  relationsScanned: number;
  overdueFindings: number;
  staleFindings: number;
  notificationsSent: number;
  unblockedVerified: number;
}

type TaskDetail = {
  id: string;
  title: string;
  sequenceId: number;
  updatedAt: Date;
  dueDate: Date | null;
  state: { group: string };
  project: { identifier: string };
  assignees: { userId: string }[];
};

const taskSelect = {
  id: true,
  title: true,
  sequenceId: true,
  updatedAt: true,
  dueDate: true,
  state: { select: { group: true } },
  project: { select: { identifier: true } },
  assignees: true,
} as const;

export async function dispatchBlockerCheck(
  projectId: string,
  now: Date = getNow(),
): Promise<BlockerCheckResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: BLOCKER_MANAGER_AGENT_KEY },
        include: { pmUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const agentSetting = project.agentSettings[0];
  if (agentSetting && !agentSetting.enabled) {
    return { relationsScanned: 0, overdueFindings: 0, staleFindings: 0, notificationsSent: 0, unblockedVerified: 0 };
  }

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
  const adminUsers = project.members.map((member) => member.user);
  const adminIds = adminUsers.map((admin) => admin.id);

  const relationRows = await prisma.taskRelation.findMany({
    where: { type: "BLOCKS", sourceTask: { projectId } },
    include: {
      sourceTask: { select: taskSelect },
      targetTask: { select: taskSelect },
    },
  });

  const relations: BlockerRelationInput[] = relationRows.map((relation) => ({
    blockingTaskId: relation.sourceTaskId,
    blockedTaskId: relation.targetTaskId,
  }));

  const taskDetailsById = new Map<string, TaskDetail>();
  for (const relation of relationRows) {
    taskDetailsById.set(relation.sourceTask.id, relation.sourceTask);
    taskDetailsById.set(relation.targetTask.id, relation.targetTask);
  }

  const tasks: BlockerTaskInput[] = [...taskDetailsById.values()].map((task) => ({
    id: task.id,
    stateGroup: task.state.group,
    dueDate: task.dueDate,
    updatedAt: task.updatedAt,
  }));

  const findings = analyzeBlockerChain(relations, tasks, now);

  let notificationsSent = 0;
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

  const startOfToday = getStartOfCalendarDay(now);

  for (const finding of findings) {
    const sent = await deliverBlockerFinding({
      finding,
      taskDetailsById,
      pmName,
      adminIds,
      projectId,
      startOfToday,
      getPreferences,
    });
    if (sent) notificationsSent += 1;
  }

  let unblockedVerified = 0;
  try {
    unblockedVerified = await verifyUnblockedSafetyNet({
      projectId,
      relations,
      taskDetailsById,
      pmUserId: agentSetting?.pmUser?.id,
      ownerId: project.owner.id,
    });
  } catch (err) {
    console.error("[Agent-004] unblocked safety net error:", err);
  }

  return {
    relationsScanned: relationRows.length,
    overdueFindings: findings.filter((f) => f.type === "overdueBlocker").length,
    staleFindings: findings.filter((f) => f.type === "staleBlocker").length,
    notificationsSent,
    unblockedVerified,
  };
}

async function deliverBlockerFinding(params: {
  finding: BlockerFinding;
  taskDetailsById: Map<string, TaskDetail>;
  pmName: string;
  adminIds: string[];
  projectId: string;
  startOfToday: Date;
  getPreferences: (userId: string) => Promise<UserNotificationPreference | null>;
}): Promise<boolean> {
  const { finding, taskDetailsById, pmName, adminIds, projectId, startOfToday, getPreferences } = params;

  const blockingTaskDetail = taskDetailsById.get(finding.blockingTaskId);
  const blockedTaskDetail = taskDetailsById.get(finding.blockedTaskId);
  if (!blockingTaskDetail || !blockedTaskDetail) return false;

  const blockingTask: BlockerTaskRef = {
    identifier: formatTaskIdentifier(blockingTaskDetail.project.identifier, blockingTaskDetail.sequenceId),
    title: blockingTaskDetail.title,
  };
  const blockedTask: BlockerTaskRef = {
    identifier: formatTaskIdentifier(blockedTaskDetail.project.identifier, blockedTaskDetail.sequenceId),
    title: blockedTaskDetail.title,
  };

  const notif = buildBlockerNotification({ pmName, type: finding.type, blockingTask, blockedTask });
  const link = buildNotificationDeepLink(projectId, blockedTaskDetail.id);

  const recipientIds = new Set<string>(adminIds);
  if (finding.type === "overdueBlocker") {
    for (const assignee of blockedTaskDetail.assignees) {
      recipientIds.add(assignee.userId);
    }
  }

  const alreadySentToday = await prisma.notification.findFirst({
    where: {
      userId: { in: [...recipientIds] },
      title: notif.title,
      link,
      createdAt: { gte: startOfToday },
    },
  });

  if (alreadySentToday) return false;

  let delivered = false;
  for (const recipientId of recipientIds) {
    const preferences = await getPreferences(recipientId);
    if (
      !shouldDeliverWithPreferences({
        actorId: null,
        recipientId,
        type: "DUE_DATE_APPROACHING",
        preferences,
      })
    ) {
      continue;
    }

    await createNotification({
      type: "DUE_DATE_APPROACHING",
      title: notif.title,
      message: notif.message,
      link,
      actorId: null,
      userId: recipientId,
    });
    delivered = true;
  }

  return delivered;
}

async function verifyUnblockedSafetyNet(params: {
  projectId: string;
  relations: BlockerRelationInput[];
  taskDetailsById: Map<string, TaskDetail>;
  pmUserId: string | undefined;
  ownerId: string;
}): Promise<number> {
  const { projectId, relations, taskDetailsById, pmUserId, ownerId } = params;

  const completedTaskIds = new Set(
    [...taskDetailsById.values()].filter((task) => task.state.group === "DONE").map((task) => task.id),
  );

  const candidateBlockedIds = new Set(
    relations
      .map((relation) => relation.blockedTaskId)
      .filter((taskId) => {
        const task = taskDetailsById.get(taskId);
        return task && task.state.group !== "DONE" && task.state.group !== "CANCELLED";
      }),
  );

  let unblockedVerified = 0;
  const actorId = pmUserId ?? ownerId;

  for (const taskId of candidateBlockedIds) {
    if (!isFullyUnblocked(taskId, relations, completedTaskIds)) continue;

    const alreadyHandled = await prisma.activity.findFirst({
      where: { taskId, type: "TASK_UNBLOCKED" },
    });
    if (alreadyHandled) continue;

    await logActivity(prisma, {
      type: "TASK_UNBLOCKED",
      taskId,
      actorId,
    });

    const blockedTask = taskDetailsById.get(taskId);
    const blockingTaskId = relations.find((relation) => relation.blockedTaskId === taskId)?.blockingTaskId;
    const blockingTask = blockingTaskId ? taskDetailsById.get(blockingTaskId) : undefined;
    if (blockedTask && blockingTask) {
      const notif = formatUnblockedNotificationMessage(blockingTask.title, blockedTask.title);
      const link = buildNotificationDeepLink(projectId, taskId);
      for (const assignee of blockedTask.assignees) {
        if (assignee.userId === actorId) continue;
        await createNotification({
          type: "TASK_UNBLOCKED",
          title: notif.title,
          message: notif.message,
          link,
          actorId,
          userId: assignee.userId,
        });
      }
    }

    unblockedVerified += 1;
  }

  return unblockedVerified;
}
