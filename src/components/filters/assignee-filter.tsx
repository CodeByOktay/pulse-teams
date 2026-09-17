"use client";

import { useBoardQuery } from "@/lib/use-board-query";
import { MultiSelectDropdown } from "@/components/filters/multi-select-dropdown";
import { Avatar } from "@/components/assignees/avatar";

export type FilterAssigneeOption = { id: string; name: string };

export function AssigneeFilter({
  members,
  selected,
}: {
  members: FilterAssigneeOption[];
  selected: string[];
}) {
  const { setParam } = useBoardQuery();

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id];
    setParam("assignee", next);
  }

  return (
    <MultiSelectDropdown
      label="Assignee"
      items={members}
      selectedIds={selected}
      onToggle={toggle}
      renderItem={(item) => (
        <span className="flex items-center gap-1.5 truncate text-zinc-700 dark:text-zinc-300">
          <Avatar name={item.name} size="sm" />
          {item.name}
        </span>
      )}
    />
  );
}
