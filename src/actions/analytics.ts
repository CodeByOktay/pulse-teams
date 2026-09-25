"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateBurndownSeries,
  calculateCycleAndLeadTimes,
  calculateTeamWorkload,
  calculateVelocityTrend,
  computeTaskFlowTimestamps,
  type BurndownDayPoint,
  type FlowMetrics,
  type MemberWorkload,
  type VelocitySummary,
} from "@/lib/project-analytics-logic";
import type { StateGroup } from "@prisma/client";

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export type ProjectAnalyticsResult = {
  sprints: Array<{ id: string; name: string; status: "DRAFT" | "ACTIVE" | "COMPLETED" }>;
  selectedSprintId: string | null;
  burndown: BurndownDayPoint[];
  velocity: VelocitySummary;
  flowMetrics: FlowMetrics;
  workload: MemberWorkload[];
  backlogCount: number;
  kpi: {
    sprintCompletionRate: number;
    wipCount: number;
  };
};

type StateChangeActivityRow = {
  taskId: string;
  createdAt: Date;
  oldValue: string | null;
  newValue: string | null;
};

/**
 * Resolves a task's TASK_STATE_CHANGED activity history into the typed
 * shape `computeTaskFlowTimestamps` expects, using the state name -> group
 * map. Also derives a reasonable `initialStateGroup` fallback for the
 * pre-history period: the resolved `oldValue` of the first activity, or
 * (if unresolved / no history) the task's current live state group.
 */
function resolveTaskFlowInputs(
  taskId: string,
  taskCreatedAt: Date,
  currentStateGroup: StateGroup,
  activitiesByTask: Map<string, StateChangeActivityRow[]>,
  stateGroupByName: Map<string, StateGroup>,
) {
  const taskActivities = activitiesByTask.get(taskId) ?? [];

  const stateChangeActivities = taskActivities
    .map((activity) => ({
      createdAt: activity.createdAt,
      toGroup: activity.newValue ? stateGroupByName.get(activity.newValue) : undefined,
    }))
    .filter(
      (activity): activity is { createdAt: Date; toGroup: StateGroup } => activity.toGroup !== undefined,
    );

  const firstActivityOldGroup =
    taskActivities.length > 0 && taskActivities[0].oldValue
      ? stateGroupByName.get(taskActivities[0].oldValue)
      : undefined;

  const initialStateGroup = firstActivityOldGroup ?? currentStateGroup;

  return computeTaskFlowTimestamps({
    createdAt: taskCreatedAt,
    initialStateGroup,
    stateChangeActivities,
  });
}

function groupActivitiesByTask(activities: StateChangeActivityRow[]): Map<string, StateChangeActivityRow[]> {
  const grouped = new Map<string, StateChangeActivityRow[]>();
  for (const activity of activities) {
    const list = grouped.get(activity.taskId);
    if (list) {
      list.push(activity);
    } else {
      grouped.set(activity.taskId, [activity]);
    }
  }
  return grouped;
}

export async function getProjectAnalytics(
  projectId: string,
  options?: { sprintId?: string },
): Promise<ProjectAnalyticsResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }
  const userId = session.user.id;

  await requireMembership(projectId, userId);

  const [states, sprints] = await Promise.all([
    prisma.state.findMany({
      where: { projectId },
      select: { id: true, name: true, group: true },
    }),
    prisma.sprint.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const stateGroupByName = new Map<string, StateGroup>(states.map((state) => [state.name, state.group]));

  // --- Resolve target sprint: requested -> ACTIVE -> most recently ended COMPLETED -> null ---
  let targetSprint = options?.sprintId ? sprints.find((sprint) => sprint.id === options.sprintId) ?? null : null;

  if (!targetSprint) {
    targetSprint = sprints.find((sprint) => sprint.status === "ACTIVE") ?? null;
  }

  if (!targetSprint) {
    const completedSprints = sprints
      .filter((sprint) => sprint.status === "COMPLETED")
      .sort((a, b) => {
        const aTime = (a.endDate ?? a.createdAt).getTime();
        const bTime = (b.endDate ?? b.createdAt).getTime();
        return bTime - aTime;
      });
    targetSprint = completedSprints[0] ?? null;
  }

  // --- Burndown + sprint completion KPI ---
  let burndown: BurndownDayPoint[] = [];
  let sprintCompletionRate = 0;

  if (targetSprint) {
    const sprintTasks = await prisma.sprintTask.findMany({
      where: { sprintId: targetSprint.id },
      select: {
        addedAt: true,
        task: {
          select: {
            id: true,
            createdAt: true,
            state: { select: { group: true } },
          },
        },
      },
    });

    const taskIds = sprintTasks.map((sprintTask) => sprintTask.task.id);

    const stateChangeActivities = await prisma.activity.findMany({
      where: { taskId: { in: taskIds }, type: "TASK_STATE_CHANGED" },
      select: { taskId: true, createdAt: true, oldValue: true, newValue: true },
      orderBy: { createdAt: "asc" },
    });

    const activitiesByTask = groupActivitiesByTask(stateChangeActivities);

    const tasksWithActivities = sprintTasks.map((sprintTask) => {
      const { completedAt } = resolveTaskFlowInputs(
        sprintTask.task.id,
        sprintTask.task.createdAt,
        sprintTask.task.state.group,
        activitiesByTask,
        stateGroupByName,
      );

      return {
        id: sprintTask.task.id,
        createdAt: sprintTask.task.createdAt,
        completedAt,
        addedToSprintAt: sprintTask.addedAt,
      };
    });

    const sprintStartDate = targetSprint.startDate ?? targetSprint.createdAt;
    const sprintEndDate = targetSprint.endDate ?? addDays(sprintStartDate, 13);

    const totalPlannedTasks = tasksWithActivities.filter(
      (task) => task.addedToSprintAt == null || task.addedToSprintAt.getTime() <= sprintStartDate.getTime(),
    ).length;

    burndown = calculateBurndownSeries({
      sprintStartDate,
      sprintEndDate,
      totalPlannedTasks,
      tasksWithActivities,
    });

    if (sprintTasks.length > 0) {
      const doneOrCancelledCount = sprintTasks.filter(
        (sprintTask) => sprintTask.task.state.group === "DONE" || sprintTask.task.state.group === "CANCELLED",
      ).length;
      sprintCompletionRate = Math.round((doneOrCancelledCount / sprintTasks.length) * 100);
    }
  }

  // --- Velocity: last 8 COMPLETED sprints, chronological ascending ---
  const completedSprintsRaw = await prisma.sprint.findMany({
    where: { projectId, status: "COMPLETED" },
    select: {
      id: true,
      name: true,
      endDate: true,
      updatedAt: true,
      tasks: {
        select: { task: { select: { state: { select: { group: true } } } } },
      },
    },
  });

  const last8CompletedSprints = completedSprintsRaw
    .sort((a, b) => {
      const aTime = (a.endDate ?? a.updatedAt).getTime();
      const bTime = (b.endDate ?? b.updatedAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 8)
    .reverse();

  const velocity = calculateVelocityTrend(
    last8CompletedSprints.map((sprint) => {
      const plannedCount = sprint.tasks.length;
      const completedCount = sprint.tasks.filter(
        (sprintTask) => sprintTask.task.state.group === "DONE" || sprintTask.task.state.group === "CANCELLED",
      ).length;
      return { id: sprint.id, name: sprint.name, plannedCount, completedCount };
    }),
  );

  // --- Flow metrics: project-wide DONE-group tasks (bounded to most recent 200) ---
  const doneTasks = await prisma.task.findMany({
    where: { projectId, state: { group: "DONE" } },
    select: { id: true, createdAt: true, state: { select: { group: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const doneTaskIds = doneTasks.map((task) => task.id);

  const doneTaskActivities = await prisma.activity.findMany({
    where: { taskId: { in: doneTaskIds }, type: "TASK_STATE_CHANGED" },
    select: { taskId: true, createdAt: true, oldValue: true, newValue: true },
    orderBy: { createdAt: "asc" },
  });

  const doneActivitiesByTask = groupActivitiesByTask(doneTaskActivities);

  const completedTasksForFlow: Array<{
    createdAt: Date;
    inProgressAt?: Date | null;
    completedAt: Date;
    stageDurations?: Record<string, number> | null;
  }> = [];

  for (const task of doneTasks) {
    const { inProgressAt, completedAt, stageDurations } = resolveTaskFlowInputs(
      task.id,
      task.createdAt,
      task.state.group,
      doneActivitiesByTask,
      stateGroupByName,
    );

    if (completedAt === null) continue;

    completedTasksForFlow.push({
      createdAt: task.createdAt,
      inProgressAt,
      completedAt,
      stageDurations,
    });
  }

  const flowMetrics = calculateCycleAndLeadTimes(completedTasksForFlow);

  // --- Workload, backlog count, WIP KPI ---
  const [membersRaw, openTasks, backlogCount, wipCount] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: { projectId, state: { group: { notIn: ["DONE", "CANCELLED"] } } },
      select: { priority: true, assignees: { select: { userId: true } } },
    }),
    prisma.task.count({
      where: { projectId, sprints: { none: { sprint: { status: { in: ["ACTIVE", "DRAFT"] } } } } },
    }),
    prisma.task.count({
      where: { projectId, state: { group: "IN_PROGRESS" } },
    }),
  ]);

  const workload = calculateTeamWorkload(
    membersRaw.map((member) => ({ id: member.user.id, name: member.user.name })),
    openTasks,
  );

  return {
    sprints: sprints.map((sprint) => ({ id: sprint.id, name: sprint.name, status: sprint.status })),
    selectedSprintId: targetSprint?.id ?? null,
    burndown,
    velocity,
    flowMetrics,
    workload,
    backlogCount,
    kpi: {
      sprintCompletionRate,
      wipCount,
    },
  };
}
