import Link from "next/link";
import type { SprintStatus, StateGroup } from "@prisma/client";
import { getSprintProgress } from "@/lib/sprint-utils";

export type BacklogSprintCardData = {
  id: string;
  name: string;
  status: SprintStatus;
  tasks: { task: { state: { group: StateGroup } } }[];
};

const STATUS_BADGE: Record<SprintStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Taslak",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  ACTIVE: {
    label: "Aktif",
    className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  COMPLETED: {
    label: "Tamamlandı",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

const PROGRESS_BAR_COLOR: Record<SprintStatus, string> = {
  DRAFT: "bg-zinc-400",
  ACTIVE: "bg-blue-500",
  COMPLETED: "bg-green-500",
};

export function SprintProgressCard({
  sprint,
  projectId,
}: {
  sprint: BacklogSprintCardData;
  projectId: string;
}) {
  const badge = STATUS_BADGE[sprint.status];
  const progress = getSprintProgress(sprint);

  return (
    <Link
      href={`/projects/${projectId}/sprints`}
      className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {sprint.name}
        </h3>
      </div>

      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${PROGRESS_BAR_COLOR[sprint.status]}`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {progress.completed}/{progress.total} görev · %{progress.percentage}
        </p>
      </div>
    </Link>
  );
}
