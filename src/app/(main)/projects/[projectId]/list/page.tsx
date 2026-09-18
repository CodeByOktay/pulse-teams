import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { FilterBar } from "@/components/filters/filter-bar";
import { ListViewContainer } from "@/components/list-view/list-view-container";
import { isBoardFiltered, parseBoardFilters } from "@/lib/board-filters";
import type { ListTask } from "@/types/list";
import type { Prisma } from "@prisma/client";

export default async function ProjectListPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const rawSearchParams = (await searchParams) ?? {};
  const filters = parseBoardFilters(rawSearchParams);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
    include: { project: true },
  });

  if (!membership) {
    notFound();
  }

  const taskWhere: Prisma.TaskWhereInput = { projectId };
  if (filters.priorities.length > 0) {
    taskWhere.priority = { in: filters.priorities };
  }
  if (filters.labelIds.length > 0) {
    taskWhere.labels = { some: { labelId: { in: filters.labelIds } } };
  }
  if (filters.assigneeIds.length > 0) {
    taskWhere.assignees = { some: { userId: { in: filters.assigneeIds } } };
  }

  const [states, labels, members, tasks, totalProjectTasks, activeSprint] = await Promise.all([
    prisma.state.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
    }),
    prisma.label.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.task.findMany({
      where: taskWhere,
      include: {
        state: true,
        labels: { include: { label: true } },
        assignees: { include: { user: true } },
      },
    }),
    prisma.task.count({ where: { projectId } }),
    prisma.sprint.findFirst({
      where: { projectId, status: "ACTIVE" },
      select: { id: true, name: true },
    }),
  ]);

  const listTasks: ListTask[] = tasks.map((task) => ({
    id: task.id,
    sequenceId: task.sequenceId,
    title: task.title,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    stateId: task.stateId,
    state: {
      id: task.state.id,
      name: task.state.name,
      color: task.state.color,
      sequence: task.state.sequence,
    },
    labels: task.labels.map((tl) => ({
      id: tl.label.id,
      name: tl.label.name,
      color: tl.label.color,
    })),
    assignees: task.assignees.map((ta) => ({ id: ta.user.id, name: ta.user.name })),
  }));

  const breadcrumbItems = [
    { label: "Staj PM", href: "/" },
    { label: membership.project.name, href: `/projects/${projectId}/board` },
    { label: "Liste" },
  ];

  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-zinc-950">
      <Header items={breadcrumbItems} />
      <FilterBar
        filters={filters}
        labels={labels}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
        projectId={projectId}
        activeView="list"
      />
      <ListViewContainer
        projectId={projectId}
        projectIdentifier={membership.project.identifier}
        tasks={listTasks}
        states={states.map((s) => ({ id: s.id, name: s.name, color: s.color, sequence: s.sequence }))}
        availableLabels={labels}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
        totalTaskCount={totalProjectTasks}
        isFiltered={isBoardFiltered(filters)}
        activeSprint={activeSprint}
      />
    </div>
  );
}
