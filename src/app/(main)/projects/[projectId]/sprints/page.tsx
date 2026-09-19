import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { EmptyState } from "@/components/ui/empty-state";
import { SprintCard } from "@/components/sprints/sprint-card";
import { CreateSprintModal } from "@/components/sprints/create-sprint-modal";
import { SprintTaskPicker } from "@/components/sprints/sprint-task-picker";
import type { SprintStatus } from "@prisma/client";

const STATUS_ORDER: Record<SprintStatus, number> = {
  ACTIVE: 0,
  DRAFT: 1,
  COMPLETED: 2,
};

export default async function ProjectSprintsPage({
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

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    include: {
      tasks: {
        include: { task: { select: { title: true, sequenceId: true, state: { select: { group: true } } } } },
      },
    },
  });

  const sortedSprints = [...sprints].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const activeSprint = sprints.find((sprint) => sprint.status === "ACTIVE");

  let activeSprintTasks: { id: string; title: string; sequenceId: number }[] = [];
  let availableTasks: { id: string; title: string; sequenceId: number }[] = [];

  if (activeSprint) {
    const [projectTasks] = await Promise.all([
      prisma.task.findMany({
        where: { projectId },
        select: { id: true, title: true, sequenceId: true },
        orderBy: { sequenceId: "asc" },
      }),
    ]);

    const sprintTaskIds = new Set(activeSprint.tasks.map((t) => t.taskId));
    activeSprintTasks = projectTasks.filter((task) => sprintTaskIds.has(task.id));
    availableTasks = projectTasks.filter((task) => !sprintTaskIds.has(task.id));
  }

  const breadcrumbItems = [
    { label: "Pulse", href: "/" },
    { label: membership.project.name, href: `/projects/${projectId}/board` },
    { label: "Sprints" },
  ];

  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-zinc-950">
      <Header items={breadcrumbItems} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Sprints</h1>
            {sortedSprints.length > 0 ? <CreateSprintModal projectId={projectId} /> : null}
          </div>

          {sortedSprints.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="Henüz sprint yok"
              description="Görevleri sprintlere ayırarak takip etmeye başlayın."
              action={<CreateSprintModal projectId={projectId} />}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {sortedSprints.map((sprint) => (
                <SprintCard key={sprint.id} sprint={sprint} />
              ))}
            </div>
          )}

          {activeSprint ? (
            <SprintTaskPicker
              sprintId={activeSprint.id}
              sprintTasks={activeSprintTasks}
              availableTasks={availableTasks}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
