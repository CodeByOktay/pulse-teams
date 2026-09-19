import type { SprintStatus } from "@prisma/client";

const ACTIVE_DRAFT_STATUSES: SprintStatus[] = ["ACTIVE", "DRAFT"];

export function isTaskInBacklog(sprintStatuses: SprintStatus[]): boolean {
  return !sprintStatuses.some((status) => ACTIVE_DRAFT_STATUSES.includes(status));
}

export function canMoveTaskToSprint(
  sprint: { status: SprintStatus } | null | undefined,
): { allowed: boolean; reason?: string } {
  if (!sprint) {
    return { allowed: false, reason: "Sprint bulunamadı." };
  }

  if (sprint.status === "COMPLETED") {
    return { allowed: false, reason: "Tamamlanmış bir sprinte görev eklenemez." };
  }

  return { allowed: true };
}

export function canDeleteSprintTaskLink(status: SprintStatus): boolean {
  return status !== "COMPLETED";
}

export function getRemovableSprintIds(
  sprintTasks: { sprintId: string; sprint: { status: SprintStatus } }[],
): string[] {
  return sprintTasks
    .filter((sprintTask) => canDeleteSprintTaskLink(sprintTask.sprint.status))
    .map((sprintTask) => sprintTask.sprintId);
}

const ACTIVE_DRAFT_ORDER: Record<SprintStatus, number> = {
  ACTIVE: 0,
  DRAFT: 1,
  COMPLETED: 2,
};

export function sortActiveDraftSprints<T extends { status: SprintStatus }>(sprints: T[]): T[] {
  return sprints
    .filter((sprint) => sprint.status === "ACTIVE" || sprint.status === "DRAFT")
    .sort((a, b) => ACTIVE_DRAFT_ORDER[a.status] - ACTIVE_DRAFT_ORDER[b.status]);
}
