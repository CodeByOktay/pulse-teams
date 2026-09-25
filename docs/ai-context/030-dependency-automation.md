# Pulse — Dependency Automation & TASK_UNBLOCKED Notifications (ADR-030)

## Overview
Pulse automatically tracks task completion transitions and resolves task dependency chains. When a task transitions into the `DONE` state group (via detail slide-over update or Kanban drag-and-drop), the system evaluates all blocked dependent tasks, verifies all their incoming blockers are resolved, writes `TASK_UNBLOCKED` audit activities, and dispatches in-app notifications with deep links to assignees.

- **Milestone:** Phase 5, Step 5.02 (`v0.5.2`)
- **ADR Reference:** `ADR-030-TASK_UNBLOCKED Bağımlılık Otomasyonu ve Bildirim Dağıtımı`
- **Automation Service:** `src/lib/dependency-automation.ts` (`triggerUnblockedDependencies`)
- **Mutation Hooks:** `src/actions/task.ts` (`updateTask`, `reorderTask`)
- **Domain Helpers:** `src/lib/automation-logic.ts` (`isCompletionTransition`, `isTaskFullyUnblocked`, `formatUnblockedNotificationMessage`, `filterSelfNotifications`)
- **Notification Route:** `src/actions/notification.ts` (`createNotification`)
- **Test Suites:** `src/lib/__tests__/dependency-automation.test.ts` (13 tests), `src/lib/__tests__/automation-logic.test.ts` (33 tests)
- **Total Test Count:** 468 tests across 24 suites (100% passing)

---

## Architectural Details & Invariants

1. **Trigger Hooks:**
   - Both `updateTask` and `reorderTask` check `isCompletionTransition(existingTask.state.group, newState.group)`.
   - On transition to `DONE`, `TASK_COMPLETED` is logged to the activity table within transaction.
   - Post-transaction, `triggerUnblockedDependencies` is invoked asynchronously.

2. **Query Optimization & Zero N+1:**
   - Evaluates outgoing relations with `type: "BLOCKS"`.
   - Filters out dependents already in `DONE` or `CANCELLED` groups.
   - Batch-fetches all incoming blockers for all affected dependents using a single `targetTaskId: { in: [...] }` query.

3. **Multi-Blocker Quiet Protection:**
   - If a task has 2 blockers and only 1 finishes, `isTaskFullyUnblocked` returns `false`.
   - No activity or notification is dispatched until the final blocker completes.

4. **Self-Notification Suppression & Deep Linking:**
   - Actor ID is removed from recipient list via `filterSelfNotifications`.
   - Deep link format: `/projects/${projectId}/board?task=${targetTaskId}`.

5. **Security Isolation:**
   - `triggerUnblockedDependencies` resides in `src/lib/` without `"use server"` to prevent client RPC spoofing.
   - Fully wrapped in `try/catch` ensuring zero failure propagation to the core task update operation.
