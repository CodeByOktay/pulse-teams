import type { Priority } from "@prisma/client";

export type SortableTask = {
  id: string;
  title: string;
  priority: Priority;
  dueDate: Date | null;
  createdAt: Date;
  state: { id: string; sequence: number };
};

export type ListSortField = "title" | "priority" | "dueDate" | "createdAt" | "stateOrder";
export type ListSortOrder = "asc" | "desc";

const PRIORITY_RANK: Record<Priority, number> = {
  NONE: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  URGENT: 5,
};

export function sortTasksByField<T extends SortableTask>(
  tasks: T[],
  field: ListSortField,
  order: ListSortOrder,
): T[] {
  const sign = order === "asc" ? 1 : -1;

  return [...tasks].sort((a, b) => {
    if (field === "dueDate") {
      if (a.dueDate === null && b.dueDate === null) return 0;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return sign * (a.dueDate.getTime() - b.dueDate.getTime());
    }

    if (field === "priority") {
      const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (diff !== 0) return sign * diff;
      return sign * (a.createdAt.getTime() - b.createdAt.getTime());
    }

    if (field === "stateOrder") {
      return sign * (a.state.sequence - b.state.sequence);
    }

    if (field === "createdAt") {
      return sign * (a.createdAt.getTime() - b.createdAt.getTime());
    }

    return sign * a.title.localeCompare(b.title);
  });
}

export type StateGroupable = { id: string; state: { id: string; sequence: number } };

export function groupTasksByState<T extends StateGroupable>(tasks: T[]): Map<string, T[]> {
  const stateSequences = new Map<string, number>();
  for (const task of tasks) {
    if (!stateSequences.has(task.state.id)) {
      stateSequences.set(task.state.id, task.state.sequence);
    }
  }

  const orderedStateIds = [...stateSequences.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([stateId]) => stateId);

  const grouped = new Map<string, T[]>();
  for (const stateId of orderedStateIds) {
    grouped.set(
      stateId,
      tasks.filter((task) => task.state.id === stateId),
    );
  }

  return grouped;
}
