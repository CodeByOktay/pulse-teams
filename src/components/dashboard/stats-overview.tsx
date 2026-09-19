import type { LucideIcon } from "lucide-react";
import { FolderKanban, ListChecks, AlertTriangle, Rocket } from "lucide-react";

export type DashboardStats = {
  activeProjects: number;
  assignedOpen: number;
  overdue: number;
  activeSprints: number;
};

const CARD_CONFIG: {
  key: keyof DashboardStats;
  label: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    key: "activeProjects",
    label: "Toplam Aktif Projeler",
    icon: FolderKanban,
    accent: "bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    key: "assignedOpen",
    label: "Bana Atanan Görevler",
    icon: ListChecks,
    accent: "bg-violet-50 text-violet-500 dark:bg-violet-950 dark:text-violet-400",
  },
  {
    key: "overdue",
    label: "Gecikmiş Görevler",
    icon: AlertTriangle,
    accent: "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400",
  },
  {
    key: "activeSprints",
    label: "Aktif Sprintler",
    icon: Rocket,
    accent: "bg-emerald-50 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-400",
  },
];

export function StatsOverview({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARD_CONFIG.map((card) => {
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
              <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {stats[card.key]}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
