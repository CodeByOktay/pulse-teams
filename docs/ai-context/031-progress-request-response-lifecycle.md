# Pulse — ProgressRequest & ProgressResponse Lifecycle (ADR-031)

## Overview
Pulse establishes an interactive progress collection lifecycle for tasks. Project managers or automated triggers can request status updates from assignees (`ProgressRequest`), which dispatches in-app notifications and renders an interactive prompt in the task detail slide-over. Assignees submit natural language status updates (`ProgressResponse`), logging audit activities and updating request status.

- **Milestone:** Phase 5, Step 5.03 (`v0.5.3`)
- **ADR Reference:** `ADR-031-İlerleme Talebi ve Yanıtı Yaşam Döngüsü (Progress Request-Response)`
- **Database Models (2 new -> 18 total):** `ProgressRequest`, `ProgressResponse`
- **Enums (1 new -> 8 total):** `ProgressRequestStatus` (`PENDING`, `RESPONDED`, `EXPIRED`, `CANCELLED`)
- **Domain Logic:** `src/lib/progress-logic.ts` (`canRequestProgress`, `validateProgressResponseContent`, `formatProgressRequestNotification`)
- **Server Actions:** `src/actions/progress.ts` (`createProgressRequest`, `submitProgressResponse`, `getTaskProgressData`)
- **UI Component:** `src/components/task-detail/task-progress-section.tsx`
- **Database Migration:** `prisma/migrations/20260925192217_add_progress_request_models/`
- **Test Suite:** `src/lib/__tests__/progress-logic.test.ts` (20 tests)
- **Total Test Count:** 488 tests across 25 suites (100% passing)

---

## Architectural Invariants & Lifecycle

1. **State Machine (`ProgressRequestStatus`):**
   - Starts at `PENDING`.
   - Transitions to `RESPONDED` atomically upon `submitProgressResponse`.
   - Protected against double-replies via `updateMany({ where: { id, status: "PENDING" } })`.

2. **Authorization & Membership:**
   - Progress requests can only be sent to users who are currently assignees of the task.
   - Only the recipient or a project admin can submit the progress response.
   - Tasks in `DONE` or `CANCELLED` groups cannot have progress requested.

3. **Input Validation:**
   - Enforces trimmed character constraints: min 3, max 2000 chars.

4. **Audit Trail & Notifications:**
   - Request creation logs `PROGRESS_REQUESTED` and sends in-app notification via `createNotification`.
   - Response submission logs `PROGRESS_RESPONDED` with a 120-char snippet metadata in the transaction.
