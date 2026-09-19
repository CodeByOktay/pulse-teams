import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { EmptyState } from "@/components/ui/empty-state";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export default async function ProjectSettingsPage({
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

  const breadcrumbItems = [
    { label: "Pulse", href: "/" },
    { label: membership.project.name, href: `/projects/${projectId}/board` },
    { label: "Ayarlar" },
  ];

  if (membership.role !== "ADMIN") {
    return (
      <div className="flex h-screen flex-col bg-gray-100 dark:bg-zinc-950">
        <Header items={breadcrumbItems} />
        <EmptyState
          icon={ShieldAlert}
          title="Bu sayfaya erişim izniniz yok"
          description="Proje ayarlarını yalnızca proje yöneticileri görüntüleyebilir."
        />
      </div>
    );
  }

  const [states, labels] = await Promise.all([
    prisma.state.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
    }),
    prisma.label.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      include: { _count: { select: { tasks: true } } },
    }),
  ]);

  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-zinc-950">
      <Header items={breadcrumbItems} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <SettingsTabs
            projectId={projectId}
            states={states.map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
              group: s.group,
              sequence: s.sequence,
            }))}
            labels={labels.map((l) => ({
              id: l.id,
              name: l.name,
              color: l.color,
              taskCount: l._count.tasks,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
