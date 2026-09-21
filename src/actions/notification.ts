"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildNotificationDeepLink,
  formatDueDateNotificationSnippet,
  getApproachingDueTasks,
  shouldDeliverWithPreferences,
} from "@/lib/notification-logic";
import type { NotificationType, Prisma } from "@prisma/client";

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
}

/**
 * Bildirim oluşturmayı try/catch ile sarmalayan yardımcı fonksiyon.
 * `logActivity`'deki dayanıklılık desenini izler: bir bildirim oluşturma
 * hatası, çağıran asıl mutasyonu asla etkilememelidir.
 */
export async function createNotification(data: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  actorId?: string | null;
  userId: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link ?? undefined,
        actorId: data.actorId ?? undefined,
        userId: data.userId,
      },
    });
  } catch (err) {
    console.error("Bildirim oluşturulamadı:", err);
  }
}

/**
 * Aynı dayanıklılık deseniyle toplu bildirim oluşturur.
 */
export async function createNotifications(
  entries: Prisma.NotificationCreateManyInput[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  try {
    await prisma.notification.createMany({ data: entries });
  } catch (err) {
    console.error("Bildirimler oluşturulamadı:", err);
  }
}

export async function getNotifications(options?: { limit?: number; unreadOnly?: boolean }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(options?.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 20,
    include: { actor: { select: { name: true, image: true } } },
  });

  return notifications;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  return prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });
}

export async function markNotificationAsRead(notificationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { read: true },
  });

  revalidatePath("/");
}

export async function markAllNotificationsAsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/");
}

export async function getUserNotificationPreferences() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const preferences = await prisma.userNotificationPreference.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  });

  return preferences;
}

export async function updateUserNotificationPreferences(
  data: Partial<{
    notifyTaskAssigned: boolean;
    notifyCommentAdded: boolean;
    notifyMentioned: boolean;
    notifyDueDateApproaching: boolean;
    notifySprintClosed: boolean;
  }>,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const updated = await prisma.userNotificationPreference.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });

  revalidatePath("/");

  return updated;
}

export async function checkApproachingDueDates(projectId?: string): Promise<number> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  if (projectId) {
    await requireMembership(projectId, session.user.id);
  }

  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { not: null },
      state: { group: { notIn: ["DONE", "CANCELLED"] } },
      ...(projectId
        ? { projectId }
        : { assignees: { some: { userId: session.user.id } } }),
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      projectId: true,
      state: { select: { group: true } },
    },
  });

  const mappedTasks = tasks.map((task) => ({
    id: task.id,
    dueDate: task.dueDate,
    stateGroup: task.state.group,
  }));

  const approaching = getApproachingDueTasks(mappedTasks);
  if (approaching.length === 0) {
    return 0;
  }

  const preferences = await prisma.userNotificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  const allowed = shouldDeliverWithPreferences({
    actorId: null,
    recipientId: session.user.id,
    type: "DUE_DATE_APPROACHING",
    preferences,
  });

  if (!allowed) {
    return 0;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const entries: Prisma.NotificationCreateManyInput[] = [];

  for (const { id: taskId, daysRemaining } of approaching) {
    const task = tasksById.get(taskId);
    if (!task) continue;

    const link = buildNotificationDeepLink(task.projectId, taskId);

    const alreadySent = await prisma.notification.findFirst({
      where: {
        userId: session.user.id,
        type: "DUE_DATE_APPROACHING",
        link: { contains: taskId },
        createdAt: { gte: startOfToday },
      },
    });

    if (alreadySent) continue;

    entries.push({
      type: "DUE_DATE_APPROACHING",
      title: "Son teslim tarihi yaklaşıyor",
      message: formatDueDateNotificationSnippet(task.title, daysRemaining),
      link,
      actorId: null,
      userId: session.user.id,
    });
  }

  await createNotifications(entries);

  return entries.length;
}
