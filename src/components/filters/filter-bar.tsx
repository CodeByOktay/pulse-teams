"use client";

import { X } from "lucide-react";
import { useBoardQuery } from "@/lib/use-board-query";
import { PriorityFilter } from "@/components/filters/priority-filter";
import { LabelFilter, type FilterLabelOption } from "@/components/filters/label-filter";
import { AssigneeFilter, type FilterAssigneeOption } from "@/components/filters/assignee-filter";
import { SortSelector } from "@/components/filters/sort-selector";
import { ViewSwitcher } from "@/components/layout/view-switcher";
import type { BoardFilters } from "@/lib/board-filters";

export function FilterBar({
  filters,
  labels,
  members,
  projectId,
  activeView,
}: {
  filters: BoardFilters;
  labels: FilterLabelOption[];
  members: FilterAssigneeOption[];
  projectId?: string;
  activeView?: "board" | "list" | "backlog";
}) {
  const { clearAll } = useBoardQuery();

  const activeFilterCount =
    filters.priorities.length + filters.labelIds.length + filters.assigneeIds.length;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-gray-100 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      {projectId && activeView ? <ViewSwitcher projectId={projectId} active={activeView} /> : null}
      <PriorityFilter selected={filters.priorities} />
      <LabelFilter labels={labels} selected={filters.labelIds} />
      <AssigneeFilter members={members} selected={filters.assigneeIds} />

      {activeFilterCount > 0 ? (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <X className="h-3.5 w-3.5" />
          Filtreleri temizle ({activeFilterCount})
        </button>
      ) : null}

      <div className="ml-auto">
        <SortSelector sort={filters.sort} order={filters.order} />
      </div>
    </div>
  );
}
