"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { deleteTask } from "@/actions/task";
import { LabelBadge } from "@/components/labels/label-badge";
import { Avatar } from "@/components/assignees/avatar";
import { stripMarkdown, truncateMarkdown } from "@/lib/markdown-utils";
import type { BoardTask } from "@/types/board";
import type { Priority } from "@prisma/client";

const PRIORITY_ICON: Record<Priority, string> = {
  URGENT: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🔵",
  NONE: "⚪",
};

function getDueDateColor(dueDate: string): string {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (due.getTime() < today.getTime()) return "text-red-600 dark:text-red-400";
  if (due.getTime() === today.getTime()) return "text-orange-500 dark:text-orange-400";
  return "text-zinc-400";
}

export function TaskCard({
  task,
  projectIdentifier,
  onOpen,
  isOverlay = false,
}: {
  task: BoardTask;
  projectIdentifier: string;
  onOpen?: (taskId: string) => void;
  isOverlay?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    if (isDragging) {
      wasDraggingRef.current = true;
    }
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const visibleLabels = task.labels.slice(0, 2);
  const extraLabels = task.labels.length - visibleLabels.length;
  const visibleAssignees = task.assignees.slice(0, 2);
  const extraAssignees = task.assignees.length - visibleAssignees.length;

  function handleDelete(event: React.MouseEvent) {
    event.stopPropagation();
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      await deleteTask(task.id);
      router.refresh();
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (isOverlay) return;
        if (wasDraggingRef.current) {
          wasDraggingRef.current = false;
          return;
        }
        onOpen?.(task.id);
      }}
      className={`group cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 ${
        isDragging ? "opacity-50" : ""
      } ${isOverlay ? "rotate-2 shadow-lg" : ""}`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-400">
          {projectIdentifier}-{task.sequenceId}
        </span>
        {isHovered && !isOverlay ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            aria-label="Görevi sil"
            className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <p className="mb-2 line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {task.title}
      </p>

      {task.description ? (
        <p className="mb-2 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {truncateMarkdown(stripMarkdown(task.description), 60)}
        </p>
      ) : null}

      {task.labels.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {visibleLabels.map((label) => (
            <LabelBadge key={label.id} name={label.name} color={label.color} />
          ))}
          {extraLabels > 0 ? (
            <span className="text-[10px] text-zinc-400">+{extraLabels}</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{PRIORITY_ICON[task.priority]}</span>
          {task.dueDate ? (
            <span className={`text-[11px] ${getDueDateColor(task.dueDate)}`}>
              {new Date(task.dueDate).toLocaleDateString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          ) : null}
        </div>

        {task.assignees.length > 0 ? (
          <div className="flex -space-x-1.5">
            {visibleAssignees.map((assignee) => (
              <Avatar key={assignee.id} name={assignee.name} size="sm" />
            ))}
            {extraAssignees > 0 ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                +{extraAssignees}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
