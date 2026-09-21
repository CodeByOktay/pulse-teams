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
