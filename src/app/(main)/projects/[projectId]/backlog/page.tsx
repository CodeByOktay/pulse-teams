import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ViewSwitcher } from "@/components/layout/view-switcher";
import { BacklogPageContainer } from "@/components/backlog/backlog-page-container";
import { sortActiveDraftSprints } from "@/lib/backlog-logic";
import type { ListTask } from "@/types/list";

export default async function ProjectBacklogPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

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

  const [states, labels, members, sprints, backlogTasks] = await Promise.all([
    prisma.state.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
    }),
    prisma.label.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.sprint.findMany({
      where: { projectId, status: { in: ["ACTIVE", "DRAFT"] } },
      include: {
        tasks: {
          include: { task: { select: { state: { select: { group: true } } } } },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        projectId,
        sprints: { none: { sprint: { status: { in: ["ACTIVE", "DRAFT"] } } } },
      },
      include: {
        state: true,
        labels: { include: { label: true } },
        assignees: { include: { user: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const activeDraftSprints = sortActiveDraftSprints(sprints);

  const listTasks: ListTask[] = backlogTasks.map((task) => ({
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
    { label: "Pulse", href: "/" },
    { label: membership.project.name, href: `/projects/${projectId}/board` },
    { label: "Backlog" },
  ];

  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-zinc-950">
      <Header items={breadcrumbItems} />

      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-gray-100 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <ViewSwitcher projectId={projectId} active="backlog" />
      </div>

      <BacklogPageContainer
        projectId={projectId}
        projectIdentifier={membership.project.identifier}
        tasks={listTasks}
        activeDraftSprints={activeDraftSprints}
        states={states.map((s) => ({ id: s.id, name: s.name, color: s.color, sequence: s.sequence }))}
        availableLabels={labels}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
      />
    </div>
  );
}
