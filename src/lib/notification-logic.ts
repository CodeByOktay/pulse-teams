import type { NotificationType } from "@prisma/client";
import { stripMarkdown } from "./markdown-utils";

/** Bir kullanıcı kendi eylemi için asla bildirim almaz; actorId olmayan sistem olayları herkese iletilir. */
export function shouldDeliverNotification(
  actorId: string | null | undefined,
  recipientId: string,
): boolean {
  return actorId !== recipientId;
}

export function formatNotificationSnippet(content: string, maxLen: number = 80): string {
  const stripped = stripMarkdown(content).trim();

  if (stripped.length <= maxLen) {
    return stripped;
  }

  let truncated = stripped.slice(0, maxLen);

  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }

  return `${truncated.trim()}...`;
}

export function buildNotificationDeepLink(projectId: string, taskId: string): string {
  return `/projects/${projectId}/board?task=${taskId}`;
}

export function buildSprintNotificationDeepLink(projectId: string): string {
  return `/projects/${projectId}/sprints`;
}

export function countUnreadNotifications(
  notifications: ReadonlyArray<{ read: boolean }>,
): number {
  return notifications.filter((notification) => notification.read === false).length;
}

const MENTION_PATTERN = /@"([^"]+)"|@([\w-]+)/g;

/** @"Full Name" (boşluklu) ve @username (kelime karakterli) biçimlerini destekler, ilk görülme sırasıyla benzersiz döner. */
export function extractMentions(content: string): string[] {
  const seen = new Set<string>();
  const handles: string[] = [];

  for (const match of content.matchAll(MENTION_PATTERN)) {
    const handle = match[1] ?? match[2];
    if (!handle) continue;

    if (!seen.has(handle)) {
      seen.add(handle);
      handles.push(handle);
    }
  }

  return handles;
}

export function resolveMentionedUserIds(
  handles: string[],
  members: Array<{ id: string; name: string }>,
): string[] {
  const resolvedIds = new Set<string>();

  for (const handle of handles) {
    const normalizedHandle = handle.toLowerCase();

    const matchedMember = members.find((member) => {
      const normalizedName = member.name.toLowerCase();
      const nameWithoutSpaces = normalizedName.replace(/\s+/g, "");
      const firstName = normalizedName.split(/\s+/)[0];

      return (
        normalizedName === normalizedHandle ||
        nameWithoutSpaces === normalizedHandle ||
        firstName === normalizedHandle
      );
    });

    if (matchedMember) {
      resolvedIds.add(matchedMember.id);
    }
  }

  return Array.from(resolvedIds);
}

export function shouldDeliverWithPreferences(params: {
  actorId?: string | null;
  recipientId: string;
  type: NotificationType;
  preferences?: {
    notifyTaskAssigned?: boolean;
    notifyCommentAdded?: boolean;
    notifyMentioned?: boolean;
    notifyDueDateApproaching?: boolean;
    notifySprintClosed?: boolean;
  } | null;
}): boolean {
  const { actorId, recipientId, type, preferences } = params;

  if (actorId !== undefined && actorId !== null && actorId === recipientId) {
    return false;
  }

  switch (type) {
    case "TASK_ASSIGNED":
      return preferences?.notifyTaskAssigned !== false;
    case "COMMENT_ADDED":
      return preferences?.notifyCommentAdded !== false;
    case "TASK_MENTIONED":
      return preferences?.notifyMentioned !== false;
    case "DUE_DATE_APPROACHING":
      return preferences?.notifyDueDateApproaching !== false;
    case "SPRINT_COMPLETED":
      return preferences?.notifySprintClosed === true;
    case "TASK_UNBLOCKED":
    case "PROGRESS_REQUESTED":
      return true;
    default:
      return true;
  }
}

function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const APPROACHING_DUE_THRESHOLDS = new Set([0, 1, 3]);

export function getApproachingDueTasks(
  tasks: Array<{ id: string; dueDate: Date | null; stateGroup: string }>,
  now: Date = new Date(),
): Array<{ id: string; daysRemaining: number }> {
  const today = startOfCalendarDay(now);

  const results: Array<{ id: string; daysRemaining: number }> = [];

  for (const task of tasks) {
    if (task.stateGroup === "DONE" || task.stateGroup === "CANCELLED") continue;
    if (!task.dueDate) continue;

    const dueDay = startOfCalendarDay(task.dueDate);
    const daysRemaining = Math.round((dueDay.getTime() - today.getTime()) / MS_PER_DAY);

    if (APPROACHING_DUE_THRESHOLDS.has(daysRemaining)) {
      results.push({ id: task.id, daysRemaining });
    }
  }

  return results;
}

export function formatDueDateNotificationSnippet(taskTitle: string, daysRemaining: number): string {
  if (daysRemaining === 0) {
    return `Bugün son gün: ${taskTitle}`;
  }

  if (daysRemaining === 1) {
    return `Yarın son gün: ${taskTitle}`;
  }

  return `${daysRemaining} gün kaldı: ${taskTitle}`;
}
