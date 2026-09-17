"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FilterX } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createTask, reorderTask } from "@/actions/task";
import { KanbanColumn } from "@/components/board/kanban-column";
import { TaskCard } from "@/components/board/task-card";
import { TaskDetailModal } from "@/components/task-detail/task-detail-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useBoardQuery } from "@/lib/use-board-query";
import type { LabelOption } from "@/components/labels/label-picker";
import type { AssigneeOption } from "@/components/assignees/assignee-picker";
import type { BoardState, BoardTask } from "@/types/board";

function calculateNewSortOrder(tasks: BoardTask[], overIndex: number): number {
  if (tasks.length === 0) return 65535;
  if (overIndex >= tasks.length) return tasks[tasks.length - 1].sortOrder + 10000;
  if (overIndex === 0) return tasks[0].sortOrder - 10000;
  const above = tasks[overIndex - 1].sortOrder;
  const below = tasks[overIndex].sortOrder;
  return (above + below) / 2;
}

export function KanbanBoard({
  projectId,
  projectIdentifier,
  initialStates,
  availableLabels,
  members,
  totalTaskCount,
  isFiltered,
}: {
  projectId: string;
  projectIdentifier: string;
  initialStates: BoardState[];
  availableLabels: LabelOption[];
  members: AssigneeOption[];
  totalTaskCount: number;
  isFiltered: boolean;
}) {
  const [columns, setColumns] = useState<BoardState[]>(initialStates);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreatingFirstTask, startCreatingFirstTask] = useTransition();
  const { clearAll } = useBoardQuery();

  useEffect(() => {
    setColumns(initialStates);
  }, [initialStates]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  function findContainerId(id: string): string | undefined {
    if (columns.some((column) => column.id === id)) return id;
    return columns.find((column) => column.tasks.some((task) => task.id === id))?.id;
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const containerId = findContainerId(id);
    const task = columns
      .find((column) => column.id === containerId)
      ?.tasks.find((t) => t.id === id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainerId = findContainerId(activeId);
    const overContainerId = findContainerId(overId);

    if (!activeContainerId || !overContainerId || activeContainerId === overContainerId) {
      return;
    }

    setColumns((prev) => {
      const activeColumn = prev.find((c) => c.id === activeContainerId);
      const overColumn = prev.find((c) => c.id === overContainerId);
      if (!activeColumn || !overColumn) return prev;

      const activeTaskItem = activeColumn.tasks.find((t) => t.id === activeId);
      if (!activeTaskItem) return prev;

      const overTaskIndex = overColumn.tasks.findIndex((t) => t.id === overId);
      const insertIndex = overTaskIndex >= 0 ? overTaskIndex : overColumn.tasks.length;

      return prev.map((column) => {
        if (column.id === activeContainerId) {
          return { ...column, tasks: column.tasks.filter((t) => t.id !== activeId) };
        }
        if (column.id === overContainerId) {
          const newTasks = [...column.tasks];
          newTasks.splice(insertIndex, 0, { ...activeTaskItem, stateId: overContainerId });
          return { ...column, tasks: newTasks };
        }
        return column;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainerId = findContainerId(activeId);
    const overContainerId = findContainerId(overId) ?? activeContainerId;

    if (!activeContainerId || !overContainerId) return;

    const overColumn = columns.find((c) => c.id === overContainerId);
    if (!overColumn) return;

    const activeIndex = overColumn.tasks.findIndex((t) => t.id === activeId);
    const overIndex = overColumn.tasks.findIndex((t) => t.id === overId);

    const tasksWithoutActive = overColumn.tasks.filter((t) => t.id !== activeId);
    let targetIndex = overIndex >= 0 ? overIndex : tasksWithoutActive.length;
    if (activeIndex >= 0 && overIndex >= 0 && activeIndex < overIndex) {
      targetIndex -= 1;
    }

    const newSortOrder = calculateNewSortOrder(tasksWithoutActive, targetIndex);

    setColumns((prev) =>
      prev.map((column) => {
        if (column.id !== overContainerId) return column;
        const reordered = [...tasksWithoutActive];
        const movedTask = overColumn.tasks.find((t) => t.id === activeId);
        if (!movedTask) return column;
        reordered.splice(targetIndex, 0, { ...movedTask, sortOrder: newSortOrder });
        return { ...column, tasks: reordered };
      }),
    );

    reorderTask(activeId, overContainerId, newSortOrder).catch(() => {
      setColumns(initialStates);
    });
  }

  const router = useRouter();
  const visibleTaskCount = columns.reduce((sum, column) => sum + column.tasks.length, 0);

  function handleCreateFirstTask() {
    const defaultStateId = columns.find((c) => c.isDefault)?.id ?? columns[0]?.id;
    if (!defaultStateId) return;
    startCreatingFirstTask(async () => {
      await createTask({ projectId, stateId: defaultStateId, title: "İlk görev" });
      router.refresh();
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {totalTaskCount === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Bu projede henüz görev yok"
          description="İlk görevinizi ekleyerek başlayın."
          action={
            <button
              type="button"
              onClick={handleCreateFirstTask}
              disabled={isCreatingFirstTask}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Görev Ekle
            </button>
          }
        />
      ) : isFiltered && visibleTaskCount === 0 ? (
        <EmptyState
          icon={FilterX}
          title="Filtrelere uygun görev bulunamadı"
          description="Farklı bir filtre kombinasyonu deneyin veya filtreleri temizleyin."
          action={
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Filtreleri temizle
            </button>
          }
        />
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              projectId={projectId}
              projectIdentifier={projectIdentifier}
              state={column}
              onOpenTask={setSelectedTaskId}
            />
          ))}
        </div>
      )}

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} projectIdentifier={projectIdentifier} isOverlay />
        ) : null}
      </DragOverlay>

      {selectedTaskId ? (
        <TaskDetailModal
          taskId={selectedTaskId}
          projectId={projectId}
          projectIdentifier={projectIdentifier}
          states={columns.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          availableLabels={availableLabels}
          members={members}
          onClose={() => setSelectedTaskId(null)}
        />
      ) : null}
    </DndContext>
  );
}
