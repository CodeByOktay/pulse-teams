import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectList } from "@/components/projects/project-list";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { MyTasksWidget, type AssignedTaskItem } from "@/components/dashboard/my-tasks-widget";
import { RecentActivityFeed, type RecentActivityItem } from "@/components/dashboard/recent-activity-feed";
import { SprintMetricsPanel, type ActiveSprintMetric } from "@/components/dashboard/sprint-metrics-panel";
import { calculateProjectVelocity } from "@/lib/analytics-logic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const now = new Date();

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: { _count: { select: { tasks: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const projects = memberships.map((membership) => ({
    id: membership.project.id,
    name: membership.project.name,
    identifier: membership.project.identifier,
    createdAt: membership.project.createdAt,
    taskCount: membership.project._count.tasks,
  }));

  const projectIds = projects.map((project) => project.id);

  const [
    assignedOpenCount,
    overdueCount,
    activeSprintsCount,
    assignedTasks,
    recentActivities,
    activeSprints,
    recentCompletedSprints,
  ] = await Promise.all([
    prisma.task.count({
      where: { assignees: { some: { userId } }, state: { group: { not: "DONE" } } },
    }),
    prisma.task.count({
      where: {
        assignees: { some: { userId } },
        dueDate: { lt: now },
        state: { group: { not: "DONE" } },
      },
    }),
    projectIds.length === 0
      ? Promise.resolve(0)
      : prisma.sprint.count({ where: { projectId: { in: projectIds }, status: "ACTIVE" } }),
    prisma.task.findMany({
      where: { assignees: { some: { userId } }, state: { group: { not: "DONE" } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        state: { select: { group: true } },
        project: { select: { id: true, name: true, identifier: true } },
      },
    }),
    prisma.activity.findMany({
      where: { task: { project: { members: { some: { userId } } } } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        actor: { select: { name: true } },
        task: { select: { id: true, projectId: true } },
      },
    }),
    projectIds.length === 0
      ? Promise.resolve([])
      : prisma.sprint.findMany({
          where: { projectId: { in: projectIds }, status: "ACTIVE" },
          include: {
            project: { select: { id: true, name: true } },
            tasks: { include: { task: { select: { state: { select: { group: true } } } } } },
          },
        }),
    projectIds.length === 0
      ? Promise.resolve([])
      : prisma.sprint.findMany({
          where: { projectId: { in: projectIds }, status: "COMPLETED" },
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: {
            tasks: { include: { task: { select: { state: { select: { group: true } } } } } },
          },
        }),
  ]);

  const stats = {
    activeProjects: projects.length,
    assignedOpen: assignedOpenCount,
    overdue: overdueCount,
    activeSprints: activeSprintsCount,
  };

  const myTasks: AssignedTaskItem[] = assignedTasks.map((task) => ({
    id: task.id,
    title: task.title,
    sequenceId: task.sequenceId,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    stateGroup: task.state.group,
    projectId: task.project.id,
    projectName: task.project.name,
    projectIdentifier: task.project.identifier,
  }));

  const activityFeed: RecentActivityItem[] = recentActivities.map((activity) => ({
    ...activity,
    createdAtIso: activity.createdAt.toISOString(),
    taskId: activity.task.id,
    projectId: activity.task.projectId,
  }));

  const sprintMetrics: ActiveSprintMetric[] = activeSprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    projectId: sprint.project.id,
    projectName: sprint.project.name,
    tasks: sprint.tasks.map((sprintTask) => ({ state: sprintTask.task.state })),
  }));

  const velocity = calculateProjectVelocity(
    recentCompletedSprints.map(
      (sprint) => sprint.tasks.filter((sprintTask) => sprintTask.task.state.group === "DONE").length,
    ),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
      </div>

      <div className="mb-6">
        <StatsOverview stats={stats} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MyTasksWidget tasks={myTasks} />
        <RecentActivityFeed activities={activityFeed} />
      </div>

      <div className="mb-6">
        <SprintMetricsPanel sprints={sprintMetrics} velocity={velocity} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Projeler</h2>
        <ProjectList projects={projects} />
      </div>
    </div>
  );
}
