import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { isTaskOverdue } from "@/lib/analytics-logic";
import type { Priority, StateGroup } from "@prisma/client";

const PRIORITY_ICON: Record<Priority, string> = {
  URGENT: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🔵",
  NONE: "⚪",
};

export type AssignedTaskItem = {
  id: string;
  title: string;
  sequenceId: number;
  priority: Priority;
  dueDate: string | null;
  stateGroup: StateGroup;
  projectId: string;
  projectName: string;
  projectIdentifier: string;
};

export function MyTasksWidget({ tasks }: { tasks: AssignedTaskItem[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Bana Atananlar</h2>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Size atanmış açık görev yok"
          description="Atandığınız görevler burada listelenir."
        />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {tasks.map((task) => {
            const overdue = isTaskOverdue(task.dueDate ? new Date(task.dueDate) : null, task.stateGroup);
            return (
              <li key={task.id}>
                <Link
                  href={`/projects/${task.projectId}/board?task=${task.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span className="shrink-0 text-sm">{PRIORITY_ICON[task.priority]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {task.title}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {task.projectIdentifier}-{task.sequenceId} · {task.projectName}
                    </p>
                  </div>
                  {task.dueDate ? (
                    <span
                      className={`shrink-0 text-xs ${
                        overdue ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-400"
                      }`}
                    >
                      {new Date(task.dueDate).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
