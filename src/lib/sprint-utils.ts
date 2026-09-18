import type { SprintStatus, StateGroup } from "@prisma/client";

const MONTHS_TR = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

function formatDay(date: Date): string {
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]}`;
}

export function isSprintOverdue(sprint: { endDate: Date | null; status: SprintStatus }): boolean {
  if (sprint.status !== "ACTIVE") {
    return false;
  }

  if (!sprint.endDate) {
    return false;
  }

  return sprint.endDate.getTime() < Date.now();
}

export function getSprintProgress(sprint: {
  tasks: { task: { state: { group: StateGroup } } }[];
}): { total: number; completed: number; percentage: number } {
  const total = sprint.tasks.length;
  const completed = sprint.tasks.filter(
    ({ task }) => task.state.group === "DONE" || task.state.group === "CANCELLED",
  ).length;

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, percentage };
}

export function formatSprintDateRange(startDate: Date | null, endDate: Date | null): string {
  if (!startDate && !endDate) {
    return "Tarih belirlenmedi";
  }

  if (startDate && !endDate) {
    return `${formatDay(startDate)}'dan itibaren`;
  }

  if (!startDate && endDate) {
    return `${formatDay(endDate)}'a kadar`;
  }

  return `${formatDay(startDate as Date)} – ${formatDay(endDate as Date)} ${(endDate as Date).getFullYear()}`;
}
