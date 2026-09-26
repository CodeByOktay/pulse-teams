"use client";

import { useState, useTransition } from "react";
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
import { calculateNewSortOrder } from "@/lib/sort-order";
import { useTaskNavigation } from "@/lib/use-task-navigation";
import type { LabelOption } from "@/components/labels/label-picker";
import type { AssigneeOption } from "@/components/assignees/assignee-picker";
import type { BoardState, BoardTask } from "@/types/board";

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 5 } };

function findColumnId(columns: BoardState[], id: string): string | undefined {
  if (columns.some((column) => column.id === id)) return id;
  return columns.find((column) => column.tasks.some((task) => task.id === id))?.id;
}

function moveTaskAcrossColumns(
  columns: BoardState[],
  activeId: string,
  activeColumnId: string,
  overColumnId: string,
  overId: string,
): BoardState[] {
  const activeColumn = columns.find((c) => c.id === activeColumnId);
  const overColumn = columns.find((c) => c.id === overColumnId);
  if (!activeColumn || !overColumn) return columns;

  const activeTaskItem = activeColumn.tasks.find((t) => t.id === activeId);
  if (!activeTaskItem) return columns;

  const overTaskIndex = overColumn.tasks.findIndex((t) => t.id === overId);
  const insertIndex = overTaskIndex >= 0 ? overTaskIndex : overColumn.tasks.length;

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, tasks: column.tasks.filter((t) => t.id !== activeId) };
    }
    if (column.id === overColumnId) {
      const newTasks = [...column.tasks];
      newTasks.splice(insertIndex, 0, { ...activeTaskItem, stateId: overColumnId });
      return { ...column, tasks: newTasks };
    }
    return column;
  });
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
  const router = useRouter();
  const [columns, setColumns] = useState<BoardState[]>(initialStates);
  const [syncedStates, setSyncedStates] = useState(initialStates);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const { clearAll } = useBoardQuery();
  const { selectedTaskId, openTask, navigateToTask, closeTaskDetail } = useTaskNavigation();
  const [isCreatingFirstTask, startCreatingFirstTask] = useTransition();

  if (syncedStates !== initialStates) {
    setSyncedStates(initialStates);
    setColumns(initialStates);
  }

  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS));

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const containerId = findColumnId(columns, id);
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
    const activeContainerId = findColumnId(columns, activeId);
    const overContainerId = findColumnId(columns, overId);

    if (!activeContainerId || !overContainerId || activeContainerId === overContainerId) {
      return;
    }

    setColumns((prev) =>
      moveTaskAcrossColumns(prev, activeId, activeContainerId, overContainerId, overId),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainerId = findColumnId(columns, activeId);
    const overContainerId = findColumnId(columns, overId) ?? activeContainerId;

    if (!activeContainerId || !overContainerId) return;

    const overColumn = columns.find((c) => c.id === overContainerId);
    if (!overColumn) return;

    const activeIndex = overColumn.tasks.findIndex((t) => t.id === activeId);
    const overIndex = overColumn.tasks.findIndex((t) => t.id === overId);
    const movedTask = overColumn.tasks.find((t) => t.id === activeId);

    const tasksWithoutActive = overColumn.tasks.filter((t) => t.id !== activeId);
    let targetIndex = overIndex >= 0 ? overIndex : tasksWithoutActive.length;
    if (activeIndex >= 0 && overIndex >= 0 && activeIndex < overIndex) {
      targetIndex -= 1;
    }

    const newSortOrder = calculateNewSortOrder(tasksWithoutActive, targetIndex);

    if (movedTask) {
      const reordered = [...tasksWithoutActive];
      reordered.splice(targetIndex, 0, { ...movedTask, sortOrder: newSortOrder });
      setColumns((prev) =>
        prev.map((column) =>
          column.id === overContainerId ? { ...column, tasks: reordered } : column,
        ),
      );
    }

    reorderTask(activeId, overContainerId, newSortOrder).catch(() => {
      setColumns(initialStates);
    });
  }

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
              onOpenTask={openTask}
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
          onClose={closeTaskDetail}
          onNavigateToTask={navigateToTask}
        />
      ) : null}
    </DndContext>
  );
}
