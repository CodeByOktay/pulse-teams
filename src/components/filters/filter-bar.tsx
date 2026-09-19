"use client";

import { X } from "lucide-react";
import { useBoardQuery } from "@/lib/use-board-query";
import { PriorityFilter } from "@/components/filters/priority-filter";
import { LabelFilter, type FilterLabelOption } from "@/components/filters/label-filter";
import { AssigneeFilter, type FilterAssigneeOption } from "@/components/filters/assignee-filter";
import { GroupFilter } from "@/components/filters/group-filter";
import { DueDateFilter } from "@/components/filters/due-date-filter";
import { SearchInput } from "@/components/filters/search-input";
import { QuickFilterChips } from "@/components/filters/quick-filter-chips";
import { SavedViewsMenu } from "@/components/filters/saved-views-menu";
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
    filters.priorities.length +
    filters.labelIds.length +
    filters.assigneeIds.length +
    filters.groups.length +
    (filters.due ? 1 : 0) +
    (filters.query.length > 0 ? 1 : 0);

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-200 bg-gray-100 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2">
        {projectId && activeView ? <ViewSwitcher projectId={projectId} active={activeView} /> : null}
        <PriorityFilter selected={filters.priorities} />
        <LabelFilter labels={labels} selected={filters.labelIds} />
        <AssigneeFilter members={members} selected={filters.assigneeIds} />
        <GroupFilter selected={filters.groups} />
        <DueDateFilter selected={filters.due} />
        <SearchInput value={filters.query} />

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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        <QuickFilterChips filters={filters} />
        {projectId ? <SavedViewsMenu projectId={projectId} filters={filters} /> : null}
      </div>
    </div>
  );
}
