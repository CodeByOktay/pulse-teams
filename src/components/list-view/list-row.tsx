"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { deleteTask } from "@/actions/task";
import { LabelBadge } from "@/components/labels/label-badge";
import { Avatar } from "@/components/assignees/avatar";
import { useClickOutside } from "@/lib/use-click-outside";
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

function getDueDateColor(dueDate: string): string {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (due.getTime() < today.getTime()) return "text-red-600 dark:text-red-400";
  if (due.getTime() === today.getTime()) return "text-orange-500 dark:text-orange-400";
  return "text-green-600 dark:text-green-400";
}

export function ListRow({
  task,
  projectIdentifier,
  isSelected = false,
  onSelect,
  onOpen,
}: {
  task: ListTask;
  projectIdentifier: string;
  isSelected?: boolean;
  onSelect?: (taskId: string, isSelected: boolean) => void;
  onOpen: (taskId: string) => void;
}) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setIsMenuOpen(false));

  const visibleLabels = task.labels.slice(0, 2);
  const extraLabels = task.labels.length - visibleLabels.length;
  const visibleAssignees = task.assignees.slice(0, 2);
  const extraAssignees = task.assignees.length - visibleAssignees.length;
  const isOverdue = task.dueDate ? new Date(task.dueDate).getTime() < Date.now() : false;

  function handleDelete() {
    setIsMenuOpen(false);
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      await deleteTask(task.id);
      router.refresh();
    });
  }

  return (
    <tr
      onClick={() => onOpen(task.id)}
      className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
    >
      <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={!onSelect}
          onChange={() => onSelect?.(task.id, isSelected)}
          className="h-3.5 w-3.5"
        />
      </td>

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

      <td className="max-w-[280px] px-3 py-2">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {task.title}
        </p>
      </td>

      <td className="px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: task.state.color }}
          />
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
            <span className="truncate text-xs text-zinc-600 dark:text-zinc-300">
              {visibleAssignees.map((a) => a.name).join(", ")}
              {extraAssignees > 0 ? ` +${extraAssignees}` : ""}
            </span>
          </div>
        )}
      </td>

      <td className="px-3 py-2">
        {task.labels.length === 0 ? (
          <span className="text-xs text-zinc-400">-</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {visibleLabels.map((label) => (
              <LabelBadge key={label.id} name={label.name} color={label.color} />
            ))}
            {extraLabels > 0 ? (
              <span className="text-[10px] text-zinc-400">+{extraLabels}</span>
            ) : null}
          </div>
        )}
      </td>

      <td className="px-3 py-2">
        {task.dueDate ? (
          <span
            className={`flex items-center gap-1 text-xs ${getDueDateColor(task.dueDate)}`}
          >
            {isOverdue ? <AlertTriangle className="h-3 w-3" /> : null}
            {new Date(task.dueDate).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">-</span>
        )}
      </td>

      <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label="Görev işlemleri"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen ? (
            <div className="absolute right-0 top-full z-40 mt-1 w-32 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpen(task.id);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Düzenle
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Sil
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
