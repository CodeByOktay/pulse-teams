import { Clock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { FlowMetrics } from "@/lib/project-analytics-logic";
import type { StateGroup } from "@prisma/client";

const STAGE_ORDER: StateGroup[] = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"];

const STAGE_LABELS: Record<StateGroup, string> = {
  BACKLOG: "Bekliyor",
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  DONE: "Tamamlandı",
  CANCELLED: "İptal",
};

const STAGE_COLORS: Record<StateGroup, string> = {
  BACKLOG: "bg-zinc-300 dark:bg-zinc-600",
  TODO: "bg-zinc-400 dark:bg-zinc-500",
  IN_PROGRESS: "bg-blue-500",
  DONE: "bg-emerald-500",
  CANCELLED: "bg-zinc-300 dark:bg-zinc-700",
};

const BOTTLENECK_COLOR = "bg-amber-500";

export function CycleLeadTimePanel({ metrics }: { metrics: FlowMetrics }) {
  const entries = STAGE_ORDER.filter(
    (stage) => (metrics.stageBreakdown[stage] ?? 0) > 0,
  ).map((stage) => ({
    stage,
    percentage: metrics.stageBreakdown[stage] ?? 0,
  }));

  if (Object.keys(metrics.stageBreakdown).length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <EmptyState icon={Clock} title="Akış verisi yok" />
      </div>
    );
  }

  const bottleneckStage = entries
    .filter((entry) => entry.stage !== "DONE" && entry.stage !== "CANCELLED")
    .reduce<{ stage: StateGroup; percentage: number } | null>((max, entry) => {
      if (max === null || entry.percentage > max.percentage) return entry;
      return max;
    }, null);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Cycle &amp; Lead Time</h2>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Medyan Lead Time</p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {metrics.medianLeadTimeDays} gün
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Ortalama: {metrics.averageLeadTimeDays} gün
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Medyan Cycle Time</p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {metrics.medianCycleTimeDays} gün
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Ortalama: {metrics.averageCycleTimeDays} gün
          </p>
        </div>
      </div>

      {bottleneckStage ? (
        <p className="mb-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          Darboğaz: {STAGE_LABELS[bottleneckStage.stage]} (%{bottleneckStage.percentage})
        </p>
      ) : null}

      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {entries.map((entry) => {
          const isBottleneck = bottleneckStage?.stage === entry.stage;
          return (
            <div
              key={entry.stage}
              style={{ width: `${entry.percentage}%` }}
              className={isBottleneck ? BOTTLENECK_COLOR : STAGE_COLORS[entry.stage]}
              title={`${STAGE_LABELS[entry.stage]}: %${entry.percentage}`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {entries.map((entry) => {
          const isBottleneck = bottleneckStage?.stage === entry.stage;
          return (
            <span key={entry.stage} className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-sm ${isBottleneck ? BOTTLENECK_COLOR : STAGE_COLORS[entry.stage]}`}
              />
              {STAGE_LABELS[entry.stage]} (%{entry.percentage})
            </span>
          );
        })}
      </div>
    </div>
  );
}
