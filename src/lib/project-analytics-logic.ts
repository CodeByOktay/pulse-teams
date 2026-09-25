import type { Priority, StateGroup } from "@prisma/client";

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

  const totalDays = Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1;
  const idealBase = Math.max(totalPlannedTasks, 0);
  const idealDivisor = totalDays - 1 === 0 ? 1 : totalDays - 1;

  const points: BurndownDayPoint[] = [];

  for (let dayIndex = 1; dayIndex <= totalDays; dayIndex++) {
    const currentDayStart = addDays(startDay, dayIndex - 1);
    const currentDayEnd = endOfDay(currentDayStart);

    const idealRemaining =
      dayIndex === totalDays ? 0 : idealBase * (1 - (dayIndex - 1) / idealDivisor);

    const completedCount = tasksWithActivities.filter(
      (task) =>
        task.completedAt != null && task.completedAt.getTime() <= currentDayEnd.getTime(),
    ).length;

    const inScopeCount = tasksWithActivities.filter(
      (task) =>
        task.addedToSprintAt == null || task.addedToSprintAt.getTime() <= currentDayEnd.getTime(),
    ).length;

    const actualRemaining = Math.max(inScopeCount - completedCount, 0);

    const scopeAdded = tasksWithActivities.filter(
      (task) =>
        task.addedToSprintAt != null &&
        task.addedToSprintAt.getTime() > sprintStartDate.getTime() &&
        isSameCalendarDay(task.addedToSprintAt, currentDayStart),
    ).length;

    points.push({
      date: formatISODate(currentDayStart),
      dayIndex,
      idealRemaining,
      actualRemaining,
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

  const averageVelocity =
    completedSprints.length === 0
      ? 0
      : Math.round(
          (completedSprints.reduce((sum, sprint) => sum + sprint.completedCount, 0) /
            completedSprints.length) *
            10,
        ) / 10;

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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateCycleAndLeadTimes(
  completedTasks: Array<{
    createdAt: Date;
    inProgressAt?: Date | null;
    completedAt: Date;
    stageDurations?: Record<string, number> | null;
  }>,
): FlowMetrics {
  const leadTimes = completedTasks.map((task) =>
    Math.max((task.completedAt.getTime() - task.createdAt.getTime()) / 86_400_000, 0),
  );

  const cycleTimes = completedTasks
    .filter((task) => task.inProgressAt != null)
    .map((task) =>
      Math.max((task.completedAt.getTime() - (task.inProgressAt as Date).getTime()) / 86_400_000, 0),
    );

  const medianLeadTimeDays = round1(median(leadTimes));
  const averageLeadTimeDays =
    leadTimes.length === 0 ? 0 : round1(leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length);
  const medianCycleTimeDays = cycleTimes.length === 0 ? 0 : round1(median(cycleTimes));
  const averageCycleTimeDays =
    cycleTimes.length === 0
      ? 0
      : round1(cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length);

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
    medianLeadTimeDays,
    averageLeadTimeDays,
    medianCycleTimeDays,
    averageCycleTimeDays,
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
