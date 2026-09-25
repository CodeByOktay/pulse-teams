import { Rocket } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { VelocitySummary } from "@/lib/project-analytics-logic";

const VIEW_WIDTH = 700;
const VIEW_HEIGHT = 280;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 40;
const PLOT_WIDTH = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

function truncateName(name: string, maxLength = 12): string {
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength - 1)}…`;
}

export function VelocityChart({
  summary,
  backlogCount,
}: {
  summary: VelocitySummary;
  backlogCount: number;
}) {
  if (summary.sprints.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <EmptyState icon={Rocket} title="Tamamlanmış sprint verisi yok" />
      </div>
    );
  }

  const maxCount = Math.max(
    ...summary.sprints.map((s) => Math.max(s.plannedCount, s.completedCount)),
    summary.averageVelocity,
    1,
  );

  const groupWidth = PLOT_WIDTH / summary.sprints.length;
  const barWidth = Math.min(groupWidth * 0.32, 40);
  const barGap = 4;

  const yForValue = (value: number): number => {
    return PADDING_TOP + PLOT_HEIGHT - (value / maxCount) * PLOT_HEIGHT;
  };

  const averageY = yForValue(summary.averageVelocity);

  const estimate = summary.estimateSprintsForBacklog(backlogCount);
  const estimateNumberLabel = estimate === Infinity ? "tahmin edilemiyor" : `${estimate}`;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sprint Hızı Trendi</h2>

      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-auto w-full overflow-visible">
        {/* Average velocity dashed line */}
        <line
          x1={PADDING_LEFT}
          x2={VIEW_WIDTH - PADDING_RIGHT}
          y1={averageY}
          y2={averageY}
          stroke="#a1a1aa"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={VIEW_WIDTH - PADDING_RIGHT}
          y={averageY - 6}
          textAnchor="end"
          className="fill-zinc-500 text-[9px] font-medium dark:fill-zinc-400"
        >
          Ortalama: {summary.averageVelocity}
        </text>

        {/* Baseline */}
        <line
          x1={PADDING_LEFT}
          x2={VIEW_WIDTH - PADDING_RIGHT}
          y1={yForValue(0)}
          y2={yForValue(0)}
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeWidth={1}
        />

        {summary.sprints.map((sprint, index) => {
          const groupCenter = PADDING_LEFT + groupWidth * index + groupWidth / 2;
          const plannedX = groupCenter - barWidth - barGap / 2;
          const completedX = groupCenter + barGap / 2;
          const plannedY = yForValue(sprint.plannedCount);
          const completedY = yForValue(sprint.completedCount);

          return (
            <g key={sprint.id}>
              <rect
                x={plannedX}
                y={plannedY}
                width={barWidth}
                height={yForValue(0) - plannedY}
                className="fill-zinc-400 dark:fill-zinc-500"
                rx={2}
              >
                <title>{`${sprint.name} · Planlanan: ${sprint.plannedCount}`}</title>
              </rect>
              <rect
                x={completedX}
                y={completedY}
                width={barWidth}
                height={yForValue(0) - completedY}
                className="fill-emerald-500"
                rx={2}
              >
                <title>{`${sprint.name} · Tamamlanan: ${sprint.completedCount}`}</title>
              </rect>
              <text
                x={groupCenter}
                y={VIEW_HEIGHT - PADDING_BOTTOM + 18}
                textAnchor="middle"
                className="fill-zinc-400 text-[9px] dark:fill-zinc-500"
              >
                {truncateName(sprint.name)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-400 dark:bg-zinc-500" />
          Planlanan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Tamamlanan
        </span>
      </div>

      <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Takım Hızı: {summary.averageVelocity} görev/sprint · Kalan Backlog tahmini {estimateNumberLabel} sprintte
        tamamlanır
      </p>
    </div>
  );
}
