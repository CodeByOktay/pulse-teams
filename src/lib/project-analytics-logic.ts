import type { Priority, StateGroup } from "@prisma/client";

const MS_PER_DAY = 86_400_000;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export type BurndownDayPoint = {
  date: string;
  dayIndex: number;
  idealRemaining: number;
  actualRemaining: number;
  completedCount: number;
  scopeAdded: number;
};

type BurndownTaskDates = {
  completedAt?: Date | null;
  addedToSprintAt?: Date | null;
};

function idealRemainingForDay(
  dayIndex: number,
  totalDays: number,
  totalPlannedTasks: number,
): number {
  // The last day (which also covers a one-day sprint) is pinned to 0, so the divisor is never 0.
  if (dayIndex === totalDays) return 0;
  return Math.max(totalPlannedTasks, 0) * (1 - (dayIndex - 1) / (totalDays - 1));
}

function countTasksForDay(
  tasks: BurndownTaskDates[],
  dayStart: Date,
  sprintStartMs: number,
): { completedCount: number; inScopeCount: number; scopeAdded: number } {
  const dayEndMs = endOfDay(dayStart).getTime();
  let completedCount = 0;
  let inScopeCount = 0;
  let scopeAdded = 0;

  for (const { completedAt, addedToSprintAt } of tasks) {
    if (completedAt != null && completedAt.getTime() <= dayEndMs) completedCount++;

    if (addedToSprintAt == null) {
      inScopeCount++;
    } else {
      const addedMs = addedToSprintAt.getTime();
      if (addedMs <= dayEndMs) inScopeCount++;
      if (addedMs > sprintStartMs && isSameCalendarDay(addedToSprintAt, dayStart)) scopeAdded++;
    }
  }

  return { completedCount, inScopeCount, scopeAdded };
}

export function calculateBurndownSeries(params: {
  sprintStartDate: Date;
  sprintEndDate: Date;
  totalPlannedTasks: number;
  tasksWithActivities: Array<{
    id: string;
    createdAt: Date;
    completedAt?: Date | null;
    addedToSprintAt?: Date | null;
  }>;
}): BurndownDayPoint[] {
  const { sprintStartDate, sprintEndDate, totalPlannedTasks, tasksWithActivities } = params;

  const startDay = startOfDay(sprintStartDate);
  const endDay = startOfDay(sprintEndDate);

  if (endDay.getTime() < startDay.getTime()) return [];

  const totalDays = Math.round((endDay.getTime() - startDay.getTime()) / MS_PER_DAY) + 1;
  const sprintStartMs = sprintStartDate.getTime();

  const points: BurndownDayPoint[] = [];

  for (let dayIndex = 1; dayIndex <= totalDays; dayIndex++) {
    const dayStart = addDays(startDay, dayIndex - 1);
    const { completedCount, inScopeCount, scopeAdded } = countTasksForDay(
      tasksWithActivities,
      dayStart,
      sprintStartMs,
    );

    points.push({
      date: formatISODate(dayStart),
      dayIndex,
      idealRemaining: idealRemainingForDay(dayIndex, totalDays, totalPlannedTasks),
      actualRemaining: Math.max(inScopeCount - completedCount, 0),
      completedCount,
      scopeAdded,
    });
  }

  return points;
}

export type SprintVelocityPoint = {
  id: string;
  name: string;
  plannedCount: number;
  completedCount: number;
  completionRate: number;
};

export type VelocitySummary = {
  sprints: SprintVelocityPoint[];
  averageVelocity: number;
  estimateSprintsForBacklog: (backlogTaskCount: number) => number;
};

export function calculateVelocityTrend(
  completedSprints: Array<{ id: string; name: string; plannedCount: number; completedCount: number }>,
): VelocitySummary {
  const sprints: SprintVelocityPoint[] = completedSprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    plannedCount: sprint.plannedCount,
    completedCount: sprint.completedCount,
    completionRate:
      sprint.plannedCount === 0 ? 0 : Math.round((sprint.completedCount / sprint.plannedCount) * 100),
  }));

  const averageVelocity = round1(mean(completedSprints.map((sprint) => sprint.completedCount)));

  const estimateSprintsForBacklog = (backlogTaskCount: number): number => {
    if (backlogTaskCount <= 0) return 0;
    if (averageVelocity <= 0) return Infinity;
    return Math.ceil(backlogTaskCount / averageVelocity);
  };

  return { sprints, averageVelocity, estimateSprintsForBacklog };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export type FlowMetrics = {
  medianLeadTimeDays: number;
  averageLeadTimeDays: number;
  medianCycleTimeDays: number;
  averageCycleTimeDays: number;
  stageBreakdown: Record<string, number>;
};

function elapsedDays(from: Date, to: Date): number {
  return Math.max((to.getTime() - from.getTime()) / MS_PER_DAY, 0);
}

export function calculateCycleAndLeadTimes(
  completedTasks: Array<{
    createdAt: Date;
    inProgressAt?: Date | null;
    completedAt: Date;
    stageDurations?: Record<string, number> | null;
  }>,
): FlowMetrics {
  const leadTimes: number[] = [];
  const cycleTimes: number[] = [];
  for (const task of completedTasks) {
    leadTimes.push(elapsedDays(task.createdAt, task.completedAt));
    if (task.inProgressAt != null) {
      cycleTimes.push(elapsedDays(task.inProgressAt, task.completedAt));
    }
  }

  const stageTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const task of completedTasks) {
    if (!task.stageDurations) continue;
    for (const [stage, duration] of Object.entries(task.stageDurations)) {
      stageTotals[stage] = (stageTotals[stage] ?? 0) + duration;
      grandTotal += duration;
    }
  }

  const stageBreakdown: Record<string, number> =
    grandTotal === 0
      ? {}
      : Object.fromEntries(
          Object.entries(stageTotals).map(([stage, duration]) => [
            stage,
            Math.round((duration / grandTotal) * 1000) / 10,
          ]),
        );

  return {
    medianLeadTimeDays: round1(median(leadTimes)),
    averageLeadTimeDays: round1(mean(leadTimes)),
    medianCycleTimeDays: round1(median(cycleTimes)),
    averageCycleTimeDays: round1(mean(cycleTimes)),
    stageBreakdown,
  };
}

export type PriorityWorkloadBreakdown = Record<"NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT", number>;

export type MemberWorkload = {
  id: string;
  name: string;
  totalOpenTasks: number;
  byPriority: PriorityWorkloadBreakdown;
  isOverloaded: boolean;
};

const EMPTY_PRIORITY_BREAKDOWN: PriorityWorkloadBreakdown = {
  NONE: 0,
  LOW: 0,
  MEDIUM: 0,
  HIGH: 0,
  URGENT: 0,
};

export function calculateTeamWorkload(
  members: Array<{ id: string; name: string }>,
  openTasks: Array<{ assignees: Array<{ userId: string }>; priority: Priority }>,
): MemberWorkload[] {
  return members.map((member) => {
    const byPriority: PriorityWorkloadBreakdown = { ...EMPTY_PRIORITY_BREAKDOWN };
    let totalOpenTasks = 0;

    for (const task of openTasks) {
      const isAssigned = task.assignees.some((assignee) => assignee.userId === member.id);
      if (!isAssigned) continue;
      totalOpenTasks += 1;
      byPriority[task.priority] += 1;
    }

    return {
      id: member.id,
      name: member.name,
      totalOpenTasks,
      byPriority,
      isOverloaded: totalOpenTasks >= 8,
    };
  });
}

export function computeTaskFlowTimestamps(params: {
  createdAt: Date;
  initialStateGroup: StateGroup;
  stateChangeActivities: Array<{ createdAt: Date; toGroup: StateGroup }>;
}): {
  inProgressAt: Date | null;
  completedAt: Date | null;
  stageDurations: Record<string, number>;
} {
  const { createdAt, initialStateGroup, stateChangeActivities } = params;

  let inProgressAt: Date | null = null;
  let completedAt: Date | null = null;
  for (const activity of stateChangeActivities) {
    if (inProgressAt === null && activity.toGroup === "IN_PROGRESS") {
      inProgressAt = activity.createdAt;
    }
    if (completedAt === null && activity.toGroup === "DONE") {
      completedAt = activity.createdAt;
    }
  }

  const stageDurations: Record<string, number> = {};

  if (stateChangeActivities.length === 0) {
    stageDurations[initialStateGroup] = 0;
    return { inProgressAt, completedAt, stageDurations };
  }

  const addDuration = (group: StateGroup, fromDate: Date, toDate: Date): void => {
    const hours = (toDate.getTime() - fromDate.getTime()) / 3_600_000;
    stageDurations[group] = (stageDurations[group] ?? 0) + Math.max(hours, 0);
  };

  const points: Array<{ time: Date; group: StateGroup }> = [
    { time: createdAt, group: initialStateGroup },
    ...stateChangeActivities.map((activity) => ({ time: activity.createdAt, group: activity.toGroup })),
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const segmentStart = points[i];
    const segmentEnd = points[i + 1];

    if (completedAt !== null && segmentStart.time.getTime() >= completedAt.getTime()) break;

    const boundedEndTime =
      completedAt !== null && segmentEnd.time.getTime() > completedAt.getTime()
        ? completedAt
        : segmentEnd.time;

    addDuration(segmentStart.group, segmentStart.time, boundedEndTime);
  }

  return { inProgressAt, completedAt, stageDurations };
}
