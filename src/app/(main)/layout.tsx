import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: { select: { id: true, name: true, identifier: true } } },
    orderBy: { createdAt: "asc" },
  });

  const projects = memberships.map((membership) => ({
    ...membership.project,
    role: membership.role,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar projects={projects} />
      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">{children}</main>
    </div>
  );
}
