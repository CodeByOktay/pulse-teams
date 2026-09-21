"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { createNotification } from "@/actions/notification";
import { buildNotificationDeepLink, shouldDeliverNotification } from "@/lib/notification-logic";

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
    await prisma.$transaction(async (tx) => {
      await tx.taskAssignee.create({ data: { taskId, userId } });
      const user = await tx.user.findUnique({ where: { id: userId } });
      await logActivity(tx, {
        type: "TASK_ASSIGNEE_ADDED",
        taskId,
        actorId: session.user.id,
        metadata: { userName: user?.name ?? "Bilinmeyen kullanıcı" },
      });
    });
  } catch {
    // already assigned — no-op
  }

  if (shouldDeliverNotification(session.user.id, userId)) {
    await createNotification({
      type: "TASK_ASSIGNED",
      title: "Yeni görev ataması",
      message: task.title,
      link: buildNotificationDeepLink(task.projectId, taskId),
      actorId: session.user.id,
      userId,
    });
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
    await prisma.$transaction(async (tx) => {
      await tx.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } });
      const user = await tx.user.findUnique({ where: { id: userId } });
      await logActivity(tx, {
        type: "TASK_ASSIGNEE_REMOVED",
        taskId,
        actorId: session.user.id,
        metadata: { userName: user?.name ?? "Bilinmeyen kullanıcı" },
      });
    });
  } catch {
    // not assigned — no-op
  }

  revalidatePath(`/projects/${task.projectId}/board`);
}
