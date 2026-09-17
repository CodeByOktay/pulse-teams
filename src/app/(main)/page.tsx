import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectList } from "@/components/projects/project-list";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Projeler</h1>
      </div>
      <ProjectList projects={projects} />
    </div>
  );
}
