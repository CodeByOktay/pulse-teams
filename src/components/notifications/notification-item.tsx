"use client";

import { CheckCircle2, MessageSquare, UserPlus } from "lucide-react";
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
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-zinc-100 dark:border-zinc-900 dark:bg-zinc-800">
          <TypeIcon className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
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
