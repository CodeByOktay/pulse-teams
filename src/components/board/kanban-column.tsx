"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AddTaskInline } from "@/components/board/add-task-inline";
import { TaskCard } from "@/components/board/task-card";
import type { BoardState } from "@/types/board";

export function KanbanColumn({
  projectId,
  projectIdentifier,
  state,
  onOpenTask,
}: {
  projectId: string;
  projectIdentifier: string;
  state: BoardState;
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: state.id });
  const taskIds = state.tasks.map((task) => task.id);

  return (
    <div className="flex w-[280px] min-w-[280px] flex-col rounded-lg bg-gray-50 dark:bg-zinc-900">
      <div className="flex shrink-0 items-center gap-2 px-3 py-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: state.color }}
        />
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{state.name}</h2>
        <span className="ml-auto text-xs text-zinc-400">{state.tasks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors ${
          isOver ? "bg-blue-50/60 dark:bg-blue-950/30" : ""
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {state.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projectIdentifier={projectIdentifier}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {state.tasks.length === 0 ? (
          <div className="flex min-h-[40px] items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700">
            Görev bırakın
          </div>
        ) : null}
      </div>

      <div className="shrink-0 px-2 pb-3 pt-1">
        <AddTaskInline projectId={projectId} stateId={state.id} />
      </div>
    </div>
  );
}
