"use client";

import { useBoardQuery } from "@/lib/use-board-query";
import { MultiSelectDropdown } from "@/components/filters/multi-select-dropdown";

export type FilterLabelOption = { id: string; name: string; color: string };

export function LabelFilter({
  labels,
  selected,
}: {
  labels: FilterLabelOption[];
  selected: string[];
}) {
  const { setParam } = useBoardQuery();

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((l) => l !== id) : [...selected, id];
    setParam("label", next);
  }

  return (
    <MultiSelectDropdown
      label="Label"
      items={labels}
      selectedIds={selected}
      onToggle={toggle}
      renderItem={(item) => (
        <span className="flex items-center gap-1.5 truncate text-zinc-700 dark:text-zinc-300">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}
        </span>
      )}
    />
  );
}
