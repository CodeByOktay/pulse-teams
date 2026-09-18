"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AddTaskInline } from "@/components/board/add-task-inline";
import { ListRow } from "@/components/list-view/list-row";
import type { ListState, ListTask } from "@/types/list";

const COLUMN_COUNT = 9;

export function ListGroupByState({
  state,
  tasks,
  projectId,
  projectIdentifier,
  onOpenTask,
  selectedTaskIds,
  onToggleSelect,
}: {
  state: ListState;
  tasks: ListTask[];
  projectId: string;
  projectIdentifier: string;
  onOpenTask: (taskId: string) => void;
  selectedTaskIds?: string[];
  onToggleSelect?: (taskId: string, isSelected: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <tbody>
      <tr
        onClick={() => setIsExpanded((v) => !v)}
        className="cursor-pointer border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        <td colSpan={COLUMN_COUNT} className="px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            )}
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: state.color }} />
            {state.name}
            <span className="text-xs font-normal text-zinc-400">({tasks.length} görev)</span>
          </div>
        </td>
      </tr>

      {isExpanded
        ? tasks.map((task) => (
            <ListRow
              key={task.id}
              task={task}
              projectIdentifier={projectIdentifier}
              isSelected={selectedTaskIds?.includes(task.id)}
              onSelect={onToggleSelect}
              onOpen={onOpenTask}
            />
          ))
        : null}

      {isExpanded ? (
        <tr className="border-b border-zinc-100 dark:border-zinc-800">
          <td colSpan={COLUMN_COUNT} className="px-3 py-1.5">
            <AddTaskInline projectId={projectId} stateId={state.id} />
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}
