import type { StateGroup } from "@prisma/client";

export function isTaskOverdue(
  dueDate: Date | null,
  stateGroup: StateGroup,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  if (stateGroup === "DONE") return false;
  return dueDate.getTime() < now.getTime();
}

export function countOverdueTasks(
  tasks: { dueDate: Date | null; state: { group: StateGroup } }[],
  now: Date = new Date(),
): number {
  return tasks.filter((task) => isTaskOverdue(task.dueDate, task.state.group, now)).length;
}

export function calculateCompletionRate(tasks: { state: { group: StateGroup } }[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.state.group === "DONE").length;
  return Math.round((completed / tasks.length) * 100);
}

/**
 * Tamamlanan görevler arasında son teslim tarihini geçmeden bitirilenlerin yüzdesi (0-100).
 * `dueDate` değeri olmayan tamamlanmış görevler zamanında sayılır; tamamlanmamışlar hesaba katılmaz.
 */
export function calculateOnTimeDeliveryRate(
  tasks: { completedAt?: Date | null; dueDate?: Date | null }[],
): number {
  let completed = 0;
  let onTime = 0;

  for (const task of tasks) {
    if (!task.completedAt) continue;
    completed++;
    if (!task.dueDate || task.completedAt.getTime() <= task.dueDate.getTime()) onTime++;
  }

  if (completed === 0) return 0;
  return Math.round((onTime / completed) * 100);
}

export function calculateSprintBurndown(
  totalTasks: number,
  completedTasksByDate: number[],
): number[] {
  return completedTasksByDate.map((completed) => Math.max(totalTasks - completed, 0));
}

export function calculateProjectVelocity(completedSprints: number[]): number {
  if (completedSprints.length === 0) return 0;
  const total = completedSprints.reduce((sum, count) => sum + count, 0);
  return Math.round((total / completedSprints.length) * 10) / 10;
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return "az önce";
  if (diffMinutes < 60) return `${diffMinutes} dakika önce`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "dün";
  if (diffDays < 30) return `${diffDays} gün önce`;

  return date.toLocaleDateString("tr-TR");
}
