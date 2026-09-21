"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NotificationType, Prisma } from "@prisma/client";

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
