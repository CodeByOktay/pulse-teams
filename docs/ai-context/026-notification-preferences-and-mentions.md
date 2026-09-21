# Pulse — Notification Preferences & Mention System (ADR-026)

## Overview
Pulse provides fine-grained notification delivery controls, mention parsing (@mentions), and approaching due date alerts. It prevents notification fatigue while guaranteeing critical callouts reach users even if generic comment notifications are muted.

- **Milestone:** Phase 4, Step 4.03 (`v0.4.3`)
- **ADR Reference:** `ADR-026-Bildirim Tercihleri, Bahsetme (Mention) ve Yaklaşan Son Tarih Uyarısı Mimarisi`
- **Domain Logic:** `src/lib/notification-logic.ts`
- **Server Actions:** `src/actions/notification.ts`, `src/actions/comment.ts`, `src/actions/assignee.ts`, `src/actions/sprint.ts`
- **UI Components:** `src/components/notifications/notification-preferences-modal.tsx`, `notification-popover.tsx`, `notification-item.tsx`
- **Test Suite:** `src/lib/__tests__/notification-preferences.test.ts` (29 tests)
- **Total Test Count:** 393 tests across 21 suites (100% passing)

---

## Data Model & Enums
Defined in `prisma/schema.prisma`:
```prisma
enum NotificationType {
  TASK_ASSIGNED
  COMMENT_ADDED
  SPRINT_COMPLETED
  TASK_MENTIONED
  DUE_DATE_APPROACHING
}

model UserNotificationPreference {
  userId                   String   @id
  notifyTaskAssigned       Boolean  @default(true)
  notifyCommentAdded       Boolean  @default(true)
  notifyMentioned          Boolean  @default(true)
  notifyDueDateApproaching Boolean  @default(true)
  notifySprintClosed       Boolean  @default(false)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Core Invariants & Rules
1. **Absolute Self-Notification Suppression:** Regardless of user preferences, `shouldDeliverWithPreferences` unconditionally blocks any notification where `actorId === recipientId`.
2. **Double-Notification Avoidance:** When a user is both assigned to a task AND `@mentioned` in a newly added comment, they receive strictly ONE `TASK_MENTIONED` notification; `COMMENT_ADDED` is suppressed for that user.
3. **Flexible Name Resolution:** `resolveMentionedUserIds` matches `@username` tokens against project members using exact full name (case-insensitive), first name, or space-stripped full name.
4. **Calendar-Day Thresholds for Due Dates:** `getApproachingDueTasks` filters non-DONE/non-CANCELLED tasks matching remaining calendar days of `0` (today), `1` (tomorrow), or `3` (in 3 days).
5. **Idempotent Due Date Alerts:** `checkApproachingDueDates` checks for existing `DUE_DATE_APPROACHING` notifications for the same task sent within the current calendar day (`createdAt >= startOfToday`) to prevent repeated alert spam.
6. **Optimistic UI with Rollback:** `NotificationPreferencesModal` updates state immediately and rolls back on server action failure.
