import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getAvatarColor } from "@/lib/colors";
import type { MemberWorkload, PriorityWorkloadBreakdown } from "@/lib/project-analytics-logic";

const PRIORITY_ORDER: (keyof PriorityWorkloadBreakdown)[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];

const PRIORITY_COLORS: Record<keyof PriorityWorkloadBreakdown, string> = {
  URGENT: "bg-rose-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-blue-500",
  NONE: "bg-zinc-300 dark:bg-zinc-600",
};

export function TeamWorkloadPanel({ workloads }: { workloads: MemberWorkload[] }) {
  if (workloads.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <EmptyState icon={Users} title="Takım üyesi yok" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Takım Yük Dağılımı</h2>
      </div>

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {workloads.map((member) => {
          const initial = member.name.trim().charAt(0).toUpperCase() || "?";
          const color = getAvatarColor(member.name);
          const total = member.totalOpenTasks;

          return (
            <li key={member.id} className="flex items-center gap-3 px-4 py-3">
              <div
                title={member.name}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {initial}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {member.name}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {total} açık görev
                    </span>
                    {member.isOverloaded ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">
                        Aşırı Yük
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  {total === 0
                    ? null
                    : PRIORITY_ORDER.map((priority) => {
                        const count = member.byPriority[priority];
                        if (count === 0) return null;
                        const pct = (count / total) * 100;
                        return (
                          <div
                            key={priority}
                            style={{ width: `${pct}%` }}
                            className={PRIORITY_COLORS[priority]}
                            title={`${priority}: ${count}`}
                          />
                        );
                      })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
