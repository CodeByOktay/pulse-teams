import type { Prisma, Priority, StateGroup } from "@prisma/client";

export const SORT_FIELDS = ["createdAt", "updatedAt", "priority", "dueDate"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

export const DUE_FILTERS = ["overdue", "today", "this_week", "no_date"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const GROUP_FILTERS: StateGroup[] = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];

const VALID_PRIORITIES: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

export type BoardFilters = {
  priorities: Priority[];
  labelIds: string[];
  assigneeIds: string[];
  groups: StateGroup[];
  due: DueFilter | null;
  query: string;
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

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseBoardFilters(
  searchParams: Record<string, string | string[] | undefined>,
): BoardFilters {
  const priorities = parseCsvParam(searchParams.priority).filter((p): p is Priority =>
    VALID_PRIORITIES.includes(p as Priority),
  );
  const labelIds = parseCsvParam(searchParams.label);
  const assigneeIds = parseCsvParam(searchParams.assignee);
  const groups = parseCsvParam(searchParams.group).filter((g): g is StateGroup =>
    GROUP_FILTERS.includes(g as StateGroup),
  );

  const rawDue = firstParam(searchParams.due);
  const due = DUE_FILTERS.includes(rawDue as DueFilter) ? (rawDue as DueFilter) : null;

  const query = (firstParam(searchParams.q) ?? "").trim();

  const rawSort = firstParam(searchParams.sort);
  const sort = SORT_FIELDS.includes(rawSort as SortField) ? (rawSort as SortField) : null;

  const rawOrder = firstParam(searchParams.order);
  const order: SortOrder = rawOrder === "asc" ? "asc" : "desc";

  return { priorities, labelIds, assigneeIds, groups, due, query, sort, order };
}

export function isBoardFiltered(filters: BoardFilters): boolean {
  return (
    filters.priorities.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.groups.length > 0 ||
    filters.due !== null ||
    filters.query.length > 0
  );
}

/** Filtre setini URL query string'ine serileştirir (Kayıtlı Görünümler için). */
export function serializeBoardFilters(filters: BoardFilters): string {
  const params = new URLSearchParams();
  if (filters.priorities.length > 0) params.set("priority", filters.priorities.join(","));
  if (filters.labelIds.length > 0) params.set("label", filters.labelIds.join(","));
  if (filters.assigneeIds.length > 0) params.set("assignee", filters.assigneeIds.join(","));
  if (filters.groups.length > 0) params.set("group", filters.groups.join(","));
  if (filters.due) params.set("due", filters.due);
  if (filters.query.length > 0) params.set("q", filters.query);
  if (filters.sort) {
    params.set("sort", filters.sort);
    params.set("order", filters.order);
  }
  return params.toString();
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Haftayı Pazartesi gunu baslatir. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
}

export type DueDateRange =
  | { kind: "isNull" }
  | { kind: "range"; gte?: Date; lte?: Date; lt?: Date };

export function resolveDueDateRange(due: DueFilter, now: Date = new Date()): DueDateRange {
  if (due === "no_date") return { kind: "isNull" };
  if (due === "overdue") return { kind: "range", lt: startOfDay(now) };
  if (due === "today") return { kind: "range", gte: startOfDay(now), lte: endOfDay(now) };
  return { kind: "range", gte: startOfWeek(now), lte: endOfWeek(now) };
}

export function matchesDueFilter(
  dueDate: Date | null,
  due: DueFilter,
  now: Date = new Date(),
): boolean {
  if (due === "no_date") return dueDate === null;
  if (dueDate === null) return false;

  const range = resolveDueDateRange(due, now);
  if (range.kind === "isNull") return false;
  if (range.lt !== undefined && dueDate.getTime() >= range.lt.getTime()) return false;
  if (range.gte !== undefined && dueDate.getTime() < range.gte.getTime()) return false;
  if (range.lte !== undefined && dueDate.getTime() > range.lte.getTime()) return false;
  return true;
}

/** Board/List sayfalarinda tekrarlanan Prisma where-clause insasini merkezilestirir. */
export function buildTaskWhereFromFilters(
  filters: BoardFilters,
  now: Date = new Date(),
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};

  if (filters.priorities.length > 0) {
    where.priority = { in: filters.priorities };
  }
  if (filters.labelIds.length > 0) {
    where.labels = { some: { labelId: { in: filters.labelIds } } };
  }
  if (filters.assigneeIds.length > 0) {
    where.assignees = { some: { userId: { in: filters.assigneeIds } } };
  }
  if (filters.groups.length > 0) {
    where.state = { group: { in: filters.groups } };
  }
  if (filters.due) {
    const range = resolveDueDateRange(filters.due, now);
    where.dueDate =
      range.kind === "isNull"
        ? null
        : {
            ...(range.gte ? { gte: range.gte } : {}),
            ...(range.lte ? { lte: range.lte } : {}),
            ...(range.lt ? { lt: range.lt } : {}),
          };
  }
  if (filters.query.length > 0) {
    where.title = { contains: filters.query, mode: "insensitive" };
  }

  return where;
}
