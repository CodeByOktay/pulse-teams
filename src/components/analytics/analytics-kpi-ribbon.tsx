import type { LucideIcon } from "lucide-react";
import { Activity, CheckCircle2, Clock, Gauge } from "lucide-react";

type KpiCardConfig = {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
};

export function AnalyticsKpiRibbon({
  sprintCompletionRate,
  averageVelocity,
  medianCycleTimeDays,
  wipCount,
}: {
  sprintCompletionRate: number;
  averageVelocity: number;
  medianCycleTimeDays: number;
  wipCount: number;
}) {
  const cards: KpiCardConfig[] = [
    {
      key: "completionRate",
      label: "Sprint Tamamlanma Oranı",
      value: `%${sprintCompletionRate}`,
      icon: CheckCircle2,
      accent: "bg-emerald-50 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-400",
    },
    {
      key: "velocity",
      label: "Takım Hızı",
      value: `${averageVelocity} görev/sprint`,
      icon: Gauge,
      accent: "bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400",
    },
    {
      key: "cycleTime",
      label: "Medyan Cycle Time",
      value: `${medianCycleTimeDays} gün`,
      icon: Clock,
      accent: "bg-violet-50 text-violet-500 dark:bg-violet-950 dark:text-violet-400",
    },
    {
      key: "wip",
      label: "Devam Eden İşler",
      value: `${wipCount}`,
      icon: Activity,
      accent: "bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {card.value}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
