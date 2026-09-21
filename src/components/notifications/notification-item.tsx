"use client";

import { AtSign, CheckCircle2, Clock, MessageSquare, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/assignees/avatar";
import { formatRelativeTime } from "@/lib/analytics-logic";
import type { getNotifications } from "@/actions/notification";
import type { NotificationType } from "@prisma/client";

type NotificationListItem = Awaited<ReturnType<typeof getNotifications>>[number];

const TYPE_ICON: Record<NotificationType, typeof UserPlus> = {
  TASK_ASSIGNED: UserPlus,
  COMMENT_ADDED: MessageSquare,
  SPRINT_COMPLETED: CheckCircle2,
  TASK_MENTIONED: AtSign,
  DUE_DATE_APPROACHING: Clock,
};

const DEFAULT_BADGE_COLOR = "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";

const TYPE_BADGE_COLOR: Record<NotificationType, string> = {
  TASK_ASSIGNED: DEFAULT_BADGE_COLOR,
  COMMENT_ADDED: DEFAULT_BADGE_COLOR,
  SPRINT_COMPLETED: DEFAULT_BADGE_COLOR,
  TASK_MENTIONED: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  DUE_DATE_APPROACHING: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
};

export function NotificationItem({
  notification,
  onRead,
}: {
  notification: NotificationListItem;
  onRead: (id: string) => void;
}) {
  const router = useRouter();
  const TypeIcon = TYPE_ICON[notification.type];
  const badgeColor = TYPE_BADGE_COLOR[notification.type];
  const actorName = notification.actor?.name ?? "Sistem";

  function handleClick() {
    if (!notification.read) {
      onRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-start gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
    >
      <div className="relative shrink-0">
        <Avatar name={actorName} size="sm" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white dark:border-zinc-900 ${badgeColor}`}
        >
          <TypeIcon className="h-2.5 w-2.5" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {notification.title}
        </p>
        <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {notification.message}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          {formatRelativeTime(new Date(notification.createdAt))}
        </p>
      </div>

      {!notification.read ? (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
      ) : null}
    </button>
  );
}
