"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { createNotifications } from "@/actions/notification";
import {
  buildNotificationDeepLink,
  formatNotificationSnippet,
  shouldDeliverNotification,
} from "@/lib/notification-logic";
import type { Prisma } from "@prisma/client";

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
}

export async function createComment({ taskId, content }: { taskId: string; content: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Yorum boş olamaz.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { taskId, content: trimmed, authorId: session.user.id },
      include: { author: { select: { id: true, name: true } } },
    });

    await logActivity(tx, {
      type: "COMMENT_ADDED",
      taskId,
      actorId: session.user.id,
    });

    return created;
  });

  const assignees = await prisma.taskAssignee.findMany({
    where: { taskId },
    select: { userId: true },
  });

  const notificationEntries: Prisma.NotificationCreateManyInput[] = assignees
    .filter((assignee) => shouldDeliverNotification(session.user.id, assignee.userId))
    .map((assignee) => ({
      type: "COMMENT_ADDED",
      title: "Yeni yorum",
      message: formatNotificationSnippet(trimmed),
      link: buildNotificationDeepLink(task.projectId, taskId),
      actorId: session.user.id,
      userId: assignee.userId,
    }));

  await createNotifications(notificationEntries);

  revalidatePath(`/projects/${task.projectId}/board`);

  return comment;
}

export async function deleteComment(commentId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { task: true },
  });

  if (!comment) {
    throw new Error("Yorum bulunamadı.");
  }

  if (comment.authorId !== session.user.id) {
    throw new Error("Sadece kendi yorumunuzu silebilirsiniz.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id: commentId } });
    await logActivity(tx, {
      type: "COMMENT_DELETED",
      taskId: comment.taskId,
      actorId: session.user.id,
    });
  });

  revalidatePath(`/projects/${comment.task.projectId}/board`);
}
