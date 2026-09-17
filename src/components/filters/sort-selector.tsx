"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useBoardQuery } from "@/lib/use-board-query";
import type { SortField, SortOrder } from "@/lib/board-filters";

const SORT_LABELS: Record<SortField, string> = {
  createdAt: "Oluşturulma tarihi",
  updatedAt: "Güncellenme tarihi",
  priority: "Öncelik",
  dueDate: "Bitiş tarihi",
};

export function SortSelector({
  sort,
  order,
}: {
  sort: SortField | null;
  order: SortOrder;
}) {
  const { setParam } = useBoardQuery();

  function handleFieldChange(value: string) {
    setParam("sort", value || null);
    if (!value) setParam("order", null);
  }

  function toggleOrder() {
    setParam("order", order === "asc" ? "desc" : "asc");
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={sort ?? ""}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 outline-none hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <option value="">Sırala</option>
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {sort ? (
        <button
          type="button"
          onClick={toggleOrder}
          aria-label={order === "asc" ? "Artan" : "Azalan"}
          className="rounded-full border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {order === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </div>
  );
}
