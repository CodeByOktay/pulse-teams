import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/assignees/avatar";
import { formatActivityMessage, type ActivityWithActor } from "@/lib/activity-logger";
import { formatRelativeTime } from "@/lib/analytics-logic";

export type RecentActivityItem = ActivityWithActor & {
  createdAtIso: string;
  taskId: string;
  projectId: string;
};

export function RecentActivityFeed({ activities }: { activities: RecentActivityItem[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Son Aktiviteler</h2>
      </div>

      {activities.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="Henüz aktivite yok" />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Link
                href={`/projects/${activity.projectId}/board?task=${activity.taskId}`}
                className="flex items-start gap-2 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <Avatar name={activity.actor?.name ?? "?"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {formatActivityMessage(activity)}
                  </p>
                  <span className="text-xs text-zinc-400">
                    {formatRelativeTime(new Date(activity.createdAtIso))}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
