import type { Priority, SprintStatus } from "@prisma/client";

export function shouldUpdateState(currentStateId: string, nextStateId: string): boolean {
  return currentStateId !== nextStateId;
}

export function shouldUpdatePriority(currentPriority: Priority, nextPriority: Priority): boolean {
  return currentPriority !== nextPriority;
}

export type TaskSprintInfo = { id: string; name: string; status: SprintStatus };

export type TaskSprintBadge =
  | { kind: "sprint"; name: string; status: SprintStatus }
  | { kind: "backlog" };

export function resolveTaskSprintBadge(sprints: TaskSprintInfo[]): TaskSprintBadge {
  const active = sprints.find((sprint) => sprint.status === "ACTIVE");
  if (active) return { kind: "sprint", name: active.name, status: active.status };

  const draft = sprints.find((sprint) => sprint.status === "DRAFT");
  if (draft) return { kind: "sprint", name: draft.name, status: draft.status };

  return { kind: "backlog" };
}

export function formatEmptyProperty(
  value: string | null | undefined,
  placeholder: string,
): string {
  return value && value.trim().length > 0 ? value : placeholder;
}

export function formatTaskDate(iso: string | null, placeholder = "Tarih Belirtilmedi"): string {
  if (!iso) return placeholder;
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildTaskBreadcrumb(
  projectName: string,
  projectIdentifier: string,
  sequenceId: number,
): string {
  return `${projectName} / ${projectIdentifier}-${sequenceId}`;
}

export function buildTaskShareUrl(origin: string, pathname: string, taskId: string): string {
  const cleanOrigin = origin.replace(/\/$/, "");
  return `${cleanOrigin}${pathname}?task=${taskId}`;
}

export function resolveOptimisticState<T>(succeeded: boolean, attempted: T, previous: T): T {
  return succeeded ? attempted : previous;
}
