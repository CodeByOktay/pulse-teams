import Link from "next/link";
import { Rocket, Gauge } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { calculateCompletionRate, calculateSprintBurndown } from "@/lib/analytics-logic";
import type { StateGroup } from "@prisma/client";

export type ActiveSprintMetric = {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  tasks: { state: { group: StateGroup } }[];
};

export function SprintMetricsPanel({
  sprints,
  velocity,
}: {
  sprints: ActiveSprintMetric[];
  velocity: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sprint Hızı</h2>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Gauge className="h-3.5 w-3.5" />
          Ortalama hız: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{velocity}</span> görev/sprint
        </div>
      </div>

      {sprints.length === 0 ? (
        <EmptyState icon={Rocket} title="Aktif sprint yok" />
      ) : (
        <ul className="flex flex-col gap-3 p-4">
          {sprints.map((sprint) => {
            const total = sprint.tasks.length;
            const completed = sprint.tasks.filter((task) => task.state.group === "DONE").length;
            const percentage = calculateCompletionRate(sprint.tasks);
            const [remaining] = calculateSprintBurndown(total, [completed]);
            return (
              <li key={sprint.id}>
                <Link
                  href={`/projects/${sprint.projectId}/sprints`}
                  className="flex flex-col gap-1.5 rounded-lg border border-zinc-100 p-3 transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {sprint.name}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{sprint.projectName}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {completed}/{total} görev tamamlandı · %{percentage} · {remaining} görev kaldı
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
