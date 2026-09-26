"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, requireMembership } from "@/lib/authz";
import { logActivity } from "@/lib/activity-logger";
import { createNotifications } from "@/actions/notification";
import {
  buildNotificationDeepLink,
  extractMentions,
  formatNotificationSnippet,
  resolveMentionedUserIds,
  shouldDeliverWithPreferences,
} from "@/lib/notification-logic";
import type { Prisma } from "@prisma/client";

export async function createComment({ taskId, content }: { taskId: string; content: string }) {
  const session = await requireSession();

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

  const [assignees, members] = await Promise.all([
    prisma.taskAssignee.findMany({
      where: { taskId },
      select: { userId: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const memberHandles = members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
  }));

  const mentionedHandles = extractMentions(trimmed);
  const mentionedUserIds = resolveMentionedUserIds(mentionedHandles, memberHandles);
  const mentionedSet = new Set(mentionedUserIds);

  const preferenceUserIds = Array.from(
    new Set([...mentionedUserIds, ...assignees.map((assignee) => assignee.userId)]),
  );

  const preferenceRows = await prisma.userNotificationPreference.findMany({
    where: { userId: { in: preferenceUserIds } },
  });
  const preferencesByUserId = new Map(preferenceRows.map((row) => [row.userId, row]));

  const mentionEntries: Prisma.NotificationCreateManyInput[] = mentionedUserIds
    .filter((userId) =>
      shouldDeliverWithPreferences({
        actorId: session.user.id,
        recipientId: userId,
        type: "TASK_MENTIONED",
        preferences: preferencesByUserId.get(userId) ?? null,
      }),
    )
    .map((userId) => ({
      type: "TASK_MENTIONED",
      title: "Bir yorumda bahsedildiniz",
      message: formatNotificationSnippet(trimmed),
      link: buildNotificationDeepLink(task.projectId, taskId),
      actorId: session.user.id,
      userId,
    }));

  const assigneeEntries: Prisma.NotificationCreateManyInput[] = assignees
    .filter((assignee) => !mentionedSet.has(assignee.userId))
    .filter((assignee) =>
      shouldDeliverWithPreferences({
        actorId: session.user.id,
        recipientId: assignee.userId,
        type: "COMMENT_ADDED",
        preferences: preferencesByUserId.get(assignee.userId) ?? null,
      }),
    )
    .map((assignee) => ({
      type: "COMMENT_ADDED",
      title: "Yeni yorum",
      message: formatNotificationSnippet(trimmed),
      link: buildNotificationDeepLink(task.projectId, taskId),
      actorId: session.user.id,
      userId: assignee.userId,
    }));

  await createNotifications([...mentionEntries, ...assigneeEntries]);

  revalidatePath(`/projects/${task.projectId}/board`);

  return comment;
}

export async function deleteComment(commentId: string) {
  const session = await requireSession();

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
