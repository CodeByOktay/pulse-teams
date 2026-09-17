import type { Priority } from "@prisma/client";

export const SORT_FIELDS = ["createdAt", "updatedAt", "priority", "dueDate"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

const VALID_PRIORITIES: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

export type BoardFilters = {
  priorities: Priority[];
  labelIds: string[];
  assigneeIds: string[];
  sort: SortField | null;
  order: SortOrder;
};

function parseCsvParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseBoardFilters(
  searchParams: Record<string, string | string[] | undefined>,
): BoardFilters {
  const priorities = parseCsvParam(searchParams.priority).filter((p): p is Priority =>
    VALID_PRIORITIES.includes(p as Priority),
  );
  const labelIds = parseCsvParam(searchParams.label);
  const assigneeIds = parseCsvParam(searchParams.assignee);

  const rawSort = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = SORT_FIELDS.includes(rawSort as SortField) ? (rawSort as SortField) : null;

  const rawOrder = Array.isArray(searchParams.order) ? searchParams.order[0] : searchParams.order;
  const order: SortOrder = rawOrder === "asc" ? "asc" : "desc";

  return { priorities, labelIds, assigneeIds, sort, order };
}

export function isBoardFiltered(filters: BoardFilters): boolean {
  return (
    filters.priorities.length > 0 || filters.labelIds.length > 0 || filters.assigneeIds.length > 0
  );
}
