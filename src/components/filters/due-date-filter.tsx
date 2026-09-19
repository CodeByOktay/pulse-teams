"use client";

import { useBoardQuery } from "@/lib/use-board-query";
import type { DueFilter } from "@/lib/board-filters";

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "overdue", label: "Gecikmiş" },
  { value: "today", label: "Bugün" },
  { value: "this_week", label: "Bu Hafta" },
  { value: "no_date", label: "Tarihsiz" },
];

export function DueDateFilter({ selected }: { selected: DueFilter | null }) {
  const { setParam } = useBoardQuery();

  return (
    <select
      value={selected ?? ""}
      onChange={(e) => setParam("due", e.target.value || null)}
      aria-label="Tarih filtresi"
      className={`rounded-full border px-3 py-1.5 text-sm outline-none ${
        selected
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      }`}
    >
      <option value="">Tarih</option>
      {DUE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
