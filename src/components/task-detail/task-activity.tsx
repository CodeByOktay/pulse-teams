"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getTaskActivities } from "@/actions/activity";
import { formatActivityMessage, type ActivityWithActor } from "@/lib/activity-logger";
import { Avatar } from "@/components/assignees/avatar";

const PAGE_SIZE = 20;

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return "az önce";
  if (diffMinutes < 60) return `${diffMinutes} dakika önce`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "dün";
  if (diffDays < 30) return `${diffDays} gün önce`;

  return date.toLocaleDateString("tr-TR");
}

type ActivityItem = ActivityWithActor & { createdAtIso: string };

export function TaskActivity({ taskId }: { taskId: string; currentUserId?: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getTaskActivities(taskId, PAGE_SIZE, 0).then((items) => {
      if (cancelled) return;
      setActivities(
        items.map((item) => ({ ...item, createdAtIso: item.createdAt.toISOString() })),
      );
      setHasMore(items.length === PAGE_SIZE);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  function loadMore() {
    setIsLoadingMore(true);
    getTaskActivities(taskId, PAGE_SIZE, activities.length).then((items) => {
      setActivities((prev) => [
        ...prev,
        ...items.map((item) => ({ ...item, createdAtIso: item.createdAt.toISOString() })),
      ]);
      setHasMore(items.length === PAGE_SIZE);
      setIsLoadingMore(false);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.length === 0 ? (
        <p className="text-sm text-zinc-400">Henüz aktivite yok.</p>
      ) : (
        activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-2">
            <Avatar name={activity.actor?.name ?? "?"} size="sm" />
            <div className="flex-1">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {formatActivityMessage(activity)}
              </p>
              <span className="text-xs text-zinc-400">
                {formatRelativeTime(activity.createdAtIso)}
              </span>
            </div>
          </div>
        ))
      )}

      {hasMore ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="self-start rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {isLoadingMore ? "Yükleniyor..." : "Tüm geçmişi göster"}
        </button>
      ) : null}
    </div>
  );
}
