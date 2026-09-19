"use client";

import { Avatar } from "@/components/assignees/avatar";
import { MoveToSprintMenu, type MoveToSprintOption } from "@/components/backlog/move-to-sprint-menu";
import type { ListTask } from "@/types/list";
import type { Priority } from "@prisma/client";

const PRIORITY_ICON: Record<Priority, string> = {
  URGENT: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🔵",
  NONE: "⚪",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Acil",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
  NONE: "Yok",
};

export function BacklogTaskRow({
  task,
  projectIdentifier,
  availableSprints,
  onOpen,
}: {
  task: ListTask;
  projectIdentifier: string;
  availableSprints: MoveToSprintOption[];
  onOpen: (taskId: string) => void;
}) {
  const visibleAssignees = task.assignees.slice(0, 2);
  const extraAssignees = task.assignees.length - visibleAssignees.length;

  return (
    <tr
      onClick={() => onOpen(task.id)}
      className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
    >
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(task.id);
          }}
          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          {projectIdentifier}-{task.sequenceId}
        </button>
      </td>

      <td className="max-w-[320px] px-3 py-2">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {task.title}
        </p>
      </td>

      <td className="px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.state.color }} />
          {task.state.name}
        </span>
      </td>

      <td className="px-3 py-2">
        <span className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
          <span>{PRIORITY_ICON[task.priority]}</span>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </td>

      <td className="px-3 py-2">
        {task.assignees.length === 0 ? (
          <span className="text-xs text-zinc-400">-</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {visibleAssignees.map((assignee) => (
                <Avatar key={assignee.id} name={assignee.name} size="sm" />
              ))}
            </div>
            {extraAssignees > 0 ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">+{extraAssignees}</span>
            ) : null}
          </div>
        )}
      </td>

      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <MoveToSprintMenu taskId={task.id} sprints={availableSprints} />
      </td>
    </tr>
  );
}
