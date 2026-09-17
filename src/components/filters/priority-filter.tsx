"use client";

import { useBoardQuery } from "@/lib/use-board-query";
import { MultiSelectDropdown } from "@/components/filters/multi-select-dropdown";
import type { Priority } from "@prisma/client";

const PRIORITY_OPTIONS: { id: Priority; label: string; icon: string }[] = [
  { id: "URGENT", label: "Urgent", icon: "🔴" },
  { id: "HIGH", label: "High", icon: "🟠" },
  { id: "MEDIUM", label: "Medium", icon: "🟡" },
  { id: "LOW", label: "Low", icon: "🔵" },
  { id: "NONE", label: "None", icon: "⚪" },
];

export function PriorityFilter({ selected }: { selected: Priority[] }) {
  const { setParam } = useBoardQuery();

  function toggle(id: string) {
    const next = selected.includes(id as Priority)
      ? selected.filter((p) => p !== id)
      : [...selected, id as Priority];
    setParam("priority", next);
  }

  return (
    <MultiSelectDropdown
      label="Priority"
      items={PRIORITY_OPTIONS}
      selectedIds={selected}
      onToggle={toggle}
      renderItem={(item) => (
        <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <span>{item.icon}</span>
          {item.label}
        </span>
      )}
    />
  );
}
