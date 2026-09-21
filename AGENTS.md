# Pulse — Agent Development Guide

## Project Identity
- **Name:** Pulse (Pulse Project Manager) — Modern Kanban & Sprint-based Project Management Application
- **Location:** `C:\Pulse`
- **Version:** v0.4.3 (Phase 4 in progress — Step 4.03 completed)
- **URL:** http://localhost:3000
- **DB:** PostgreSQL 16 (Docker container: `pulse-postgres`, port 5432)

## AI Agent Division of Labor & Guides
- **Antigravity (Lead Architect, QA & Test Authority):** `ANTIGRAVITY.md` — Feature analysis, trade-offs, Claude prompt formulation, exclusive author of all tests (`src/lib/__tests__/`), ADR authoring, and `docs/ai-context/` management.
- **Claude Code (Builder & Subagent Orchestrator):** `CLAUDE.md` — Layered implementation (`postgres-pro`, `backend-developer`, `react-specialist`, `nextjs-developer`, `debugger`). Does not write tests; runs Antigravity's tests and fixes code without modifying test files.

## Technology Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Database ORM:** Prisma v6.19.3 + PostgreSQL 16
- **Authentication:** NextAuth.js v4 — CredentialsProvider + JWT + bcryptjs (salt:12)
  (sole authentication method; external identity provider integration is strictly out of scope)
- **Styling:** Tailwind CSS v4
- **Drag-and-Drop:** @dnd-kit/core + @dnd-kit/sortable
- **Markdown:** react-markdown + remark-gfm
- **Icons:** lucide-react
- **Testing:** Vitest v5 (`npm test` → `vitest run`)

## Commands
- `npm run dev` — Start development server (localhost:3000)
- `npm test` — Run all Vitest unit and integration suites
- `npm run build` — Production build check
- `npx prisma studio` — Open Prisma database GUI
- `npx prisma db push` — Apply schema changes to database
- `npx prisma migrate dev --name <name>` — Create and apply migrations
- `npx prisma generate` — Regenerate Prisma client
- `npx tsc --noEmit` — Run TypeScript type checking

## Database Models (16 Models across Phases 1, 2, 3, and 4)
User, Project, ProjectMember, State, Task, Label, TaskLabel, TaskAssignee, Comment,
Sprint, SprintTask, Activity, ProjectInvite, TaskRelation, **Notification, UserNotificationPreference**

Enums (7):
- StateGroup (BACKLOG, TODO, IN_PROGRESS, DONE, CANCELLED)
- Priority (NONE, LOW, MEDIUM, HIGH, URGENT)
- SprintStatus (DRAFT, ACTIVE, COMPLETED)
- ActivityType (17 values)
- InviteStatus (PENDING, ACCEPTED, EXPIRED)
- RelationType (BLOCKS, RELATES_TO, DUPLICATES)
- **NotificationType** (TASK_ASSIGNED, COMMENT_ADDED, SPRINT_COMPLETED, TASK_MENTIONED, DUE_DATE_APPROACHING)

## Critical Architectural Decisions
- **Prisma Singleton:** `src/lib/prisma.ts` — `globalThis` pattern (hot-reload safe in development).
- **Server Actions:** Located under `src/actions/` with `"use server"` directive.
- **Membership Authorization:** Every action enforces `requireMembership(projectId, userId)`.
- **Role-Based Authorization:** State and project configuration actions require `requireAdmin(projectId, userId)` (`role === "ADMIN"`).
- **Float-Based Ordering:** `sortOrder` / `State.sequence` are Floats. Midpoint insertion: `(upper + lower) / 2`.
- **Monotonic Sequence IDs:** `getNextSequenceId()` — project-scoped incrementing integer (`PRJ-1`, `PRJ-2`).
- **Avatar Color Generation:** `getAvatarColor(name)` — bitwise hash mapping to a 10-color curated Tailwind palette.
- **Server-Side Filtering:** URL search params based, directly compiled into Prisma where clauses.
- **Optimistic UI:** Kanban drag-and-drop applies optimistic state with automatic rollback on server error.
- **State Deletion Safety:** `onDelete: Restrict` — tasks must be moved to another state prior to deletion; `canDeleteState()` ensures the last remaining state cannot be deleted.
- **Non-blocking Activity Logging:** `logActivity(tx, data)` runs inside transaction blocks with internal try/catch; logging failure never rolls back the primary operation.
- **Single Active Sprint Constraint:** A project can have at most one ACTIVE sprint at any time (`canStartSprint`).
- **Bulk Action Guardrails:** `bulkUpdateTasks` capped at ≤100 tasks, `bulkDeleteTasks` capped at ≤50 tasks; same-project ownership of all task IDs is strictly validated on the server.
- **Markdown Safe Clipping:** `truncateMarkdown` clips text at word boundaries and balances unclosed `**` and ``` tokens.
- **Invitation Lifecycle:** `inviteMember` requires ADMIN role, generates 32-byte hex token valid for 7 days (`expiresAt`). `acceptInvite` enforces recipient email matching. Project owner (`ownerId`) cannot be removed or demoted.
- **Task Detail Popovers:** `StatusPicker` and `PriorityPicker` built on `InlineSelectPopover` with optimistic UI and keyboard navigation; mutations skipped if the same value is selected.
- **Sprint Badge Hierarchy:** `resolveTaskSprintBadge` resolves ACTIVE > DRAFT > Backlog.
- **Deep Linking:** `buildTaskShareUrl` generates URLs with `?task=` query parameter, auto-opening task slide-over on board and list views.
- **Backlog Invariants:** `isTaskInBacklog` checks if a task is not linked to any ACTIVE or DRAFT sprint (COMPLETED sprint history is preserved as backlog); `moveTaskToSprint` / `moveTaskToBacklog` only modify ACTIVE/DRAFT links, never deleting COMPLETED sprint history.
- **Global Search & Command Palette:** `globalSearch(query)` requires ≥2 characters, searches task titles / `PRJ-X` identifiers (max 10) and projects (max 5) across member projects. `CommandPalette` provides Ctrl+K / Cmd+K keyboard navigation and context-aware quick actions.
- **Dashboard Analytics:** Pure logic in `src/lib/analytics-logic.ts` (`isTaskOverdue`, `countOverdueTasks`, `calculateCompletionRate`, `calculateSprintBurndown`, `calculateProjectVelocity`, `formatRelativeTime`). Dashboard renders 4 count cards, "Assigned to Me" widget, "Recent Activity Feed", and "Sprint Velocity" CSS progress bars without external charting libraries.
- **Advanced Filters & Saved Views:** `BoardFilters` unified via `buildTaskWhereFromFilters` into a single Prisma where input. Quick filter chips provide 1-click toggles. `useSavedViews` manages localStorage persistence (`pulse:saved-views:{projectId}`) with `__me__` dynamic placeholder resolution.
- **Task Relations (Dependency Graph):** `TaskRelation` is strictly a SINGLE row in the DB. "Blocked By" is an inverted perspective of a BLOCKS record (reverse rows are never inserted). `hasExistingRelation` enforces the single-pair rule across both directions. Cycle detection is strictly enforced for BLOCKS via `wouldCreateBlockCycle` (iterative DFS with stack + visited set, non-recursive, safe against stack overflows). `addTaskRelation` derives `projectId` from verified task records, ensuring both tasks reside in the same project.
- **Notification Delivery & Preferences:** `shouldDeliverWithPreferences` strictly enforces self-notification suppression (`actorId !== recipientId`) and maps against recipient `UserNotificationPreference` fields. `@mention` parsing (`extractMentions`, `resolveMentionedUserIds`) extracts callouts; mentioned assignees receive only `TASK_MENTIONED` (preventing double notification). Approaching due date alerts (`getApproachingDueTasks`) check calendar day thresholds (0, 1, 3 days) with idempotency per calendar day.

## Testing Conventions
- **Location:** `src/lib/__tests__/*.test.ts`
- **Framework:** Vitest — `import { describe, it, expect, vi } from "vitest"`
- **Rule:** Server actions are not directly executed in unit tests; business logic is isolated into pure domain functions (`src/lib/*.ts`).
- **Mocks:** `vi.fn().mockResolvedValue()` used for Prisma client mocking where applicable.
- **Suites:**
  - `sequence.test.ts` (2), `sort-order.test.ts` (4), `colors.test.ts` (3), `board-filters.test.ts` (5)
  - `sprint-utils.test.ts` (13), `sprint-actions.test.ts` (11), `list-view-sort.test.ts` (15)
  - `activity-logger.test.ts` (14), `bulk-selection.test.ts` (18), `markdown-utils.test.ts` (21)
  - `settings-validation.test.ts` (30), `member-management.test.ts` (28), `task-detail-ux.test.ts` (19)
  - `backlog-logic.test.ts` (23), `search-logic.test.ts` (24), `dashboard-analytics.test.ts` (25)
  - `advanced-filters.test.ts` (36), `task-relations.test.ts` (40)
  - `seed-data-generators.test.ts` (17), `notification-logic.test.ts` (16)
  - **`notification-preferences.test.ts` (29)**
- **Total:** **393 tests, 100% passing**

## Code Style
- **Import Alias:** `@/*` maps to `src/*`
- **Components:** PascalCase, Server Component by default (use `"use client"` only when interactive)
- **Actions:** camelCase with mandatory `"use server"` directive
- **Errors:** Descriptive error throwing (`throw new Error("...")`)
- **Cache Revalidation:** Mandatory `revalidatePath()` after every mutation

## Completed Phases
- **Phase 1 (v0.1.0):** Core Kanban, Auth, CRUD, Slide-over (14 tests)
- **Phase 2 (v0.2.0):** Sprints/Cycles, List View, Audit Log, Bulk Actions, Markdown Editor, Settings (136 tests)
- **Phase 3 (v0.3.0):** Member Invites, Task Detail UX, Backlog View, Global Search Cmd+K, Dashboard Analytics, Advanced Filters, Task Relations (331 tests)
- **Phase 4 (v0.4.0 — In Progress):**
  - **Step 4.01 (v0.4.1):** Realistic Analytics Dataset & Generators, Deterministic PRNG Seeding (348 tests)
  - **Step 4.02 (v0.4.2):** In-App Notifications with Client Polling, Triggers & Popover UI (364 tests)
  - **Step 4.03 (v0.4.3):** User Notification Preferences, Mention Detection (@user) & Approaching Due Date Alerts (393 tests)

## Verification Rule After Every Step
```bash
npm test          # All test suites must pass 100% (393 tests)
npx tsc --noEmit  # Zero TypeScript compilation errors
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
