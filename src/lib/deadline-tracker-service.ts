/**
 * Agent-001 (Deadline Tracker) service — Phase 6 Step 6.02 (ADR-034).
 *
 * Session-independent and project-scoped: invoked by the `pulse-agent` container
 * through `POST /api/internal/agent/deadline-check`. Deterministic, zero LLM tokens.
 */
import type { Prisma, UserNotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { buildNotificationDeepLink, shouldDeliverWithPreferences } from "@/lib/notification-logic";
import { formatTaskIdentifier } from "@/lib/relation-logic";
import {
  DEADLINE_TRACKER_AGENT_KEY,
  ESCALATION_TITLE,
  buildDeadlineReminder,
  buildEscalationNotice,
  getCalendarDaysRemaining,
  getStartOfCalendarDay,
  isOverdue,
  resolvePmName,
  shouldProcessDeadline,
} from "@/lib/deadline-tracker-logic";

export interface DeadlineCheckResult {
  tasksScanned: number;
  remindersSent: number;
  escalationsSent: number;
  skippedDueToPreferences: number;
}

const EMPTY_RESULT: DeadlineCheckResult = {
  tasksScanned: 0,
  remindersSent: 0,
  escalationsSent: 0,
  skippedDueToPreferences: 0,
};

export async function dispatchDueDateReminders(
  projectId: string,
  now: Date = getNow(),
): Promise<DeadlineCheckResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: DEADLINE_TRACKER_AGENT_KEY },
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

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
  const adminUsers = project.members.map((member) => member.user);

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      dueDate: { not: null },
      state: { group: { notIn: ["DONE", "CANCELLED"] } },
    },
    include: {
      assignees: { include: { user: { select: { id: true, name: true } } } },
      state: { select: { name: true, group: true } },
    },
  });

  const startOfToday = getStartOfCalendarDay(now);
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

  let remindersSent = 0;
  let escalationsSent = 0;
  let skippedDueToPreferences = 0;
  const notificationsToCreate: Prisma.NotificationCreateManyInput[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const daysRemaining = getCalendarDaysRemaining(task.dueDate, now);
    if (!shouldProcessDeadline(daysRemaining)) continue;

    const link = buildNotificationDeepLink(projectId, task.id);
    const taskIdentifier = formatTaskIdentifier(project.identifier, task.sequenceId);

    // A. Reminder to every assignee
    const reminder = buildDeadlineReminder({
      pmName,
      taskIdentifier,
      taskTitle: task.title,
      daysRemaining,
    });

    for (const assignee of task.assignees) {
      const recipientId = assignee.user.id;

      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId: recipientId,
          type: "DUE_DATE_APPROACHING",
          link: { contains: task.id },
          createdAt: { gte: startOfToday },
        },
      });
      if (alreadySent) continue;

      const preferences = await getPreferences(recipientId);
      if (
        !shouldDeliverWithPreferences({
          actorId: null,
          recipientId,
          type: "DUE_DATE_APPROACHING",
          preferences,
        })
      ) {
        skippedDueToPreferences++;
        continue;
      }

      notificationsToCreate.push({
        type: "DUE_DATE_APPROACHING",
        title: reminder.title,
        message: reminder.message,
        link,
        userId: recipientId,
        actorId: null,
      });
      remindersSent++;
    }

    // B. Overdue -> escalate to every project ADMIN
    if (isOverdue(daysRemaining)) {
      const escalation = buildEscalationNotice({
        taskIdentifier,
        taskTitle: task.title,
        daysOverdue: Math.abs(daysRemaining),
        assigneeNames: task.assignees.map((assignee) => assignee.user.name),
      });

      for (const admin of adminUsers) {
        const alreadyEscalated = await prisma.notification.findFirst({
          where: {
            userId: admin.id,
            type: "DUE_DATE_APPROACHING",
            link: { contains: task.id },
            title: { contains: "Eskalasyon" },
            createdAt: { gte: startOfToday },
          },
        });
        if (alreadyEscalated) continue;

        notificationsToCreate.push({
          type: "DUE_DATE_APPROACHING",
          title: ESCALATION_TITLE,
          message: escalation.message,
          link,
          userId: admin.id,
          actorId: null,
        });
        escalationsSent++;
      }
    }
  }

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({ data: notificationsToCreate });
  }

  return {
    tasksScanned: tasks.length,
    remindersSent,
    escalationsSent,
    skippedDueToPreferences,
  };
}
