"use client";

import { useSession } from "next-auth/react";
import { useBoardQuery } from "@/lib/use-board-query";
import type { BoardFilters } from "@/lib/board-filters";

export function QuickFilterChips({ filters }: { filters: BoardFilters }) {
  const { data: session } = useSession();
  const { setParam } = useBoardQuery();
  const currentUserId = session?.user?.id;

  const isMine =
    !!currentUserId && filters.assigneeIds.length === 1 && filters.assigneeIds[0] === currentUserId;
  const isUrgent = filters.priorities.length === 1 && filters.priorities[0] === "URGENT";
  const isOverdue = filters.due === "overdue";
  const isIncomplete =
    filters.groups.length === 2 &&
    filters.groups.includes("TODO") &&
    filters.groups.includes("IN_PROGRESS");

  const chips = [
    {
      key: "mine",
      label: "Bana Atananlar",
      active: isMine,
      disabled: !currentUserId,
      onClick: () => currentUserId && setParam("assignee", isMine ? null : [currentUserId]),
    },
    {
      key: "urgent",
      label: "Acil Görevler",
      active: isUrgent,
      disabled: false,
      onClick: () => setParam("priority", isUrgent ? null : ["URGENT"]),
    },
    {
      key: "overdue",
      label: "Gecikmişler",
      active: isOverdue,
      disabled: false,
      onClick: () => setParam("due", isOverdue ? null : "overdue"),
    },
    {
      key: "incomplete",
      label: "Tamamlanmamışlar",
      active: isIncomplete,
      disabled: false,
      onClick: () => setParam("group", isIncomplete ? null : ["TODO", "IN_PROGRESS"]),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          disabled={chip.disabled}
          onClick={chip.onClick}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            chip.active
              ? "border-blue-400 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
