# Pulse — In-App Notifications & Client Polling (ADR-025)

## Overview
Pulse features a persistent, lightweight in-app notification system backed by PostgreSQL and periodic client-side polling. It provides real-time awareness for team collaboration events without the operational complexity of stateful WebSockets.

- **Milestone:** Phase 4, Step 4.02 (`v0.4.2`)
- **ADR Reference:** `ADR-025-Uygulama İçi Bildirimler ve İstemci Polling Mimarisi`
- **Domain Logic:** `src/lib/notification-logic.ts`
- **Server Actions:** `src/actions/notification.ts`
- **Client Hook:** `src/lib/use-notification-polling.ts`
- **UI Components:** `src/components/notifications/notification-bell.tsx`, `notification-popover.tsx`, `notification-item.tsx`
- **Header Placement:** `src/components/layout/header.tsx` (next to user avatar)
- **Test Suite:** `src/lib/__tests__/notification-logic.test.ts` (16 tests)

---

## Data Model & Enums
Defined in `prisma/schema.prisma`:
```prisma
enum NotificationType {
  TASK_ASSIGNED
  COMMENT_ADDED
  SPRINT_COMPLETED
}

model Notification {
  id        String           @id @default(cuid())
  userId    String           // Recipient
  actorId   String?          // Actor / Triggering User
  type      NotificationType
  title     String
  message   String
  link      String?          // Deep link e.g. /projects/[id]/board?task=[taskId]
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())

  user      User             @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  actor     User?            @relation("ActorNotifications", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([userId, read])
  @@index([userId, createdAt])
}
```

---

## Core Invariants & Rules
1. **Self-Notification Suppression:** Users NEVER receive notifications for actions they performed themselves (`actorId !== recipientId`). Enforced via `shouldDeliverNotification`.
2. **Resilient Non-Blocking Triggers:** Notification creation (`createNotification` / `createNotifications`) is wrapped in internal try/catch blocks. A failure in notification dispatch will NEVER abort or roll back the primary database transaction (`assignUserToTask`, `createComment`, `completeSprint`).
3. **Tab Visibility Awareness:** Polling runs on a 30-second interval via `useNotificationPolling`, but automatically pauses when the browser tab is hidden (`document.visibilityState === "hidden"`), resuming immediately when focused.
4. **Optimistic Read Feedback:** Clicking a notification marks it as read optimistically in local state before triggering `markNotificationAsRead` and navigating to the deep link.
5. **Phase 4.03 Forward Compatibility:** The `NotificationType` enum is 1-to-1 mapped with the upcoming Notification Preferences schema fields (`notifyTaskAssigned`, `notifyCommentAdded`, `notifySprintClosed`).
