/**
 * Internal agent API — POST /api/internal/agent/notifications (Phase 6 — ADR-034).
 *
 * Called by the Python `pulse-agent` container to deliver batches of
 * notifications on behalf of automated agents. Requests are authenticated via
 * HMAC signature (`verifyInternalSignature`), not a NextAuth session.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { syncClockFromDb } from "@/lib/clock";
import { shouldDeliverWithPreferences } from "@/lib/notification-logic";
import { createNotifications } from "@/actions/notification";
import type { NotificationType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type IncomingNotification = {
  userId?: string;
  type?: NotificationType;
  title?: string;
  message?: string;
  link?: string | null;
  actorId?: string | null;
};

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notifications?: IncomingNotification[] };
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const notifications = body.notifications;
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return NextResponse.json(
      { error: "notifications alanı boş olmayan bir dizi olmalıdır." },
      { status: 400 },
    );
  }

  for (const entry of notifications) {
    if (!entry.userId || !entry.type || !entry.title || !entry.message) {
      return NextResponse.json(
        { error: "Her bildirim için userId, type, title ve message zorunludur." },
        { status: 400 },
      );
    }
  }

  try {
    await syncClockFromDb();

    const userIds = [...new Set(notifications.map((entry) => entry.userId as string))];
    const preferences = await prisma.userNotificationPreference.findMany({
      where: { userId: { in: userIds } },
    });
    const preferencesByUser = new Map(preferences.map((pref) => [pref.userId, pref]));

    const entries: Prisma.NotificationCreateManyInput[] = notifications
      .filter((entry) =>
        shouldDeliverWithPreferences({
          actorId: entry.actorId ?? null,
          recipientId: entry.userId as string,
          type: entry.type as NotificationType,
          preferences: preferencesByUser.get(entry.userId as string) ?? null,
        }),
      )
      .map((entry) => ({
        type: entry.type as NotificationType,
        title: entry.title as string,
        message: entry.message as string,
        link: entry.link ?? undefined,
        actorId: entry.actorId ?? undefined,
        userId: entry.userId as string,
      }));

    await createNotifications(entries);

    return NextResponse.json({ ok: true, delivered: entries.length });
  } catch (error) {
    console.error("[Internal Agent API] notifications error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
