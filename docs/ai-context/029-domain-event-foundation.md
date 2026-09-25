# Pulse — Domain Event Foundation & Activity Expansion (ADR-029)

## Overview
Pulse establishes a resilient, deterministic domain event foundation for proactive project coordination. It expands NotificationType and ActivityType enums, introduces an `isAiGenerated` audit flag on Activity records, and isolates state completion and unblocking algorithms into pure domain functions under `src/lib/automation-logic.ts`.

- **Milestone:** Phase 5, Step 5.01 (`v0.5.1`)
- **ADR Reference:** `ADR-029-Domain Event Temeli ve Aktivite Genişletmesi`
- **Domain Logic:** `src/lib/automation-logic.ts` (`isCompletionTransition`, `isReopeningTransition`, `isTaskFullyUnblocked`, `findNewlyUnblockedTasks`, `formatUnblockedNotificationMessage`, `filterSelfNotifications`)
- **Audit System:** `src/lib/activity-logger.ts` (`logActivity` with `isAiGenerated`, `formatActivityMessage` with 6 new activity types)
- **Notification Delivery:** `src/lib/notification-logic.ts` (`shouldDeliverWithPreferences` handling `TASK_UNBLOCKED`, `PROGRESS_REQUESTED`)
- **UI Components:** `src/components/notifications/notification-item.tsx` (`LockOpen` and `CircleHelp` icons, badge styling)
- **Database Migration:** `prisma/migrations/20260925185210_add_ai_coordination_events/`
- **Test Suite:** `src/lib/__tests__/automation-logic.test.ts` (26 tests), `src/lib/__tests__/activity-logger.test.ts` (+6 tests -> 20 tests)
- **Total Test Count:** 448 tests across 23 suites (100% passing)

---

## Architecture & Domain Event Flow

1. **Enum Expansions:**
   - `NotificationType` (+2 -> 7 values): `TASK_UNBLOCKED`, `PROGRESS_REQUESTED`.
   - `ActivityType` (+6 -> 23 values): `TASK_COMPLETED`, `TASK_UNBLOCKED`, `PROGRESS_REQUESTED`, `PROGRESS_RESPONDED`, `AI_SUGGESTION_APPLIED`, `AI_SUGGESTION_REJECTED`.

2. **Activity AI Distinction:**
   - `Activity.isAiGenerated: Boolean @default(false)` differentiates human actions from autonomous agent operations (rendered with a `🤖` badge in UI feeds).

3. **Deterministic State Transition Detection:**
   - `isCompletionTransition(oldGroup, newGroup)`: Pure evaluator verifying if state changes from a non-DONE group to `DONE`. Prevents redundant triggers on renames or intra-DONE moves.
   - `isReopeningTransition(oldGroup, newGroup)`: Detects reopening of completed tasks.

4. **Multi-Blocker Dependency Resolution:**
   - `isTaskFullyUnblocked(blockers)`: Returns `true` only when all blocker tasks for a dependent task are in `DONE` status group.
   - `findNewlyUnblockedTasks(params)`: Identifies dependent tasks that have transitioned to unblocked status and resolves their notification recipient user IDs.
   - `filterSelfNotifications(recipientIds, actorId)`: Strictly prevents notifying a user about an unblock caused by their own task completion.

5. **Resilient Notification & Audit Logging:**
   - New notification types default to delivered while respecting `actorId !== recipientId` suppression.
   - Activity logger generates native Turkish audit strings for all 6 new activity types.
