"use client";

import { useBoardQuery } from "@/lib/use-board-query";
import { MultiSelectDropdown } from "@/components/filters/multi-select-dropdown";
import type { StateGroup } from "@prisma/client";

const GROUP_OPTIONS: { id: StateGroup; label: string }[] = [
  { id: "TODO", label: "Yapılacak" },
  { id: "IN_PROGRESS", label: "Devam Ediyor" },
  { id: "DONE", label: "Tamamlandı" },
  { id: "CANCELLED", label: "İptal Edildi" },
];

export function GroupFilter({ selected }: { selected: StateGroup[] }) {
  const { setParam } = useBoardQuery();

  function toggle(id: string) {
    const next = selected.includes(id as StateGroup)
      ? selected.filter((g) => g !== id)
      : [...selected, id as StateGroup];
    setParam("group", next);
  }

  return (
    <MultiSelectDropdown
      label="Durum"
      items={GROUP_OPTIONS}
      selectedIds={selected}
      onToggle={toggle}
      renderItem={(item) => <span className="text-zinc-700 dark:text-zinc-300">{item.label}</span>}
    />
  );
}
