"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
}

export async function assignUserToTask(taskId: string, userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);
  await requireMembership(task.projectId, userId);

  try {
    await prisma.taskAssignee.create({ data: { taskId, userId } });
  } catch {
    // already assigned — no-op
  }

  revalidatePath(`/projects/${task.projectId}/board`);
}

export async function unassignUserFromTask(taskId: string, userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  try {
    await prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } });
  } catch {
    // not assigned — no-op
  }

  revalidatePath(`/projects/${task.projectId}/board`);
}
