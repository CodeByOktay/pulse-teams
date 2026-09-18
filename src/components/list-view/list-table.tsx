"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  groupTasksByState,
  sortTasksByField,
  type ListSortField,
  type ListSortOrder,
  type SortableTask,
} from "@/lib/list-view-sort";
import { ListGroupByState } from "@/components/list-view/list-group-by-state";
import type { ListTask } from "@/types/list";

const HEADERS: { field: ListSortField | null; label: string }[] = [
  { field: null, label: "" },
  { field: null, label: "ID" },
  { field: "title", label: "Başlık" },
  { field: "stateOrder", label: "Durum" },
  { field: "priority", label: "Öncelik" },
  { field: null, label: "Görevli" },
  { field: null, label: "Etiketler" },
  { field: "dueDate", label: "Bitiş Tarihi" },
  { field: null, label: "İşlemler" },
];

function toSortable(task: ListTask): SortableTask {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    createdAt: new Date(task.createdAt),
    state: { id: task.state.id, sequence: task.state.sequence },
  };
}

function sortListTasks(tasks: ListTask[], field: ListSortField, order: ListSortOrder): ListTask[] {
  const sortedIds = sortTasksByField(tasks.map(toSortable), field, order).map((t) => t.id);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return sortedIds.map((id) => byId.get(id)!);
}

export function ListTable({
  tasks,
  projectId,
  projectIdentifier,
  onOpenTask,
  selectedTaskIds,
  onToggleSelect,
}: {
  tasks: ListTask[];
  projectId: string;
  projectIdentifier: string;
  onOpenTask: (taskId: string) => void;
  selectedTaskIds?: string[];
  onToggleSelect?: (taskId: string, isSelected: boolean) => void;
}) {
  const [sortField, setSortField] = useState<ListSortField>("stateOrder");
  const [sortOrder, setSortOrder] = useState<ListSortOrder>("asc");

  function handleHeaderClick(field: ListSortField) {
    if (field === sortField) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  const groups = useMemo(() => {
    const grouped = groupTasksByState(tasks);
    return [...grouped.entries()].map(([stateId, groupTasks]) => {
      const state = groupTasks[0]?.state;
      return {
        stateId,
        state,
        tasks: sortListTasks(groupTasks, sortField, sortOrder),
      };
    });
  }, [tasks, sortField, sortOrder]);

  return (
    <div className="overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-900">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {HEADERS.map((header) => (
              <th
                key={header.label || "checkbox"}
                onClick={header.field ? () => handleHeaderClick(header.field!) : undefined}
                className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${
                  header.field ? "cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200" : ""
                }`}
              >
                <span className="flex items-center gap-1">
                  {header.label}
                  {header.field === sortField ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {groups.map((group) =>
          group.state ? (
            <ListGroupByState
              key={group.stateId}
              state={group.state}
              tasks={group.tasks}
              projectId={projectId}
              projectIdentifier={projectIdentifier}
              onOpenTask={onOpenTask}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={onToggleSelect}
            />
          ) : null,
        )}
      </table>
    </div>
  );
}
