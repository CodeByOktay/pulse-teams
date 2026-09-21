# CONTEXT - Pulse Project Manager (v0.4.2 -> Phase 4.02 Completed)
Paste this file into a new AI chat. The agent will immediately grasp the full project context.

## What is the Project?
Pulse Project Manager. A modern, full-featured Kanban and Sprint-based project management platform. Phases 1, 2, and 3 are fully completed; Phase 4.01 (Analytics Dataset) and Phase 4.02 (In-App Notifications with Polling) are completed.

## Location & Execution
- **Project Path:** `C:\Pulse`
- **Database:** PostgreSQL 16 in Docker (`docker start pulse-postgres`, port 5432)
- **Dev Server:** `cd C:\Pulse && npm run dev` -> `http://localhost:3000`
- **Tests:** `npm test` (364 tests across 20 suites, 100% passing)
- **Seed Rich Data:** `npm run db:seed-rich` (10 users, 5 projects, 500 tasks, 1000 comments, 3000 activities)

## AI Agent Division of Labor & Guides
- **Antigravity (Lead Architect & QA/Test Authority):** Detailed rules in `ANTIGRAVITY.md` — Feature evaluation, trade-off analysis, implementation plans, Claude prompt generation, exclusive author of all tests (`src/lib/__tests__/`), ADRs (`docs/wiki/`), and AI context management (`docs/ai-context/`).
- **Claude Code (Builder & Subagent Orchestrator):** Detailed rules in `CLAUDE.md` — Layered implementation (`postgres-pro`, `backend-developer`, `react-specialist`, `nextjs-developer`, `debugger`). Does NOT write tests; runs Antigravity's tests and fixes code without modifying test files.

## Tech Stack
Next.js 16 App Router (Turbopack) + TypeScript (strict mode) + Tailwind CSS v4 + Prisma v6.19.3 + PostgreSQL 16
NextAuth.js v4 (JWT, CredentialsProvider) + @dnd-kit + react-markdown + remark-gfm + Vitest v5 + lucide-react

Authentication scope: Strictly CredentialsProvider (email/password + bcrypt salt:12).
External identity providers (OAuth) are explicitly out of scope and will not be planned.

## Phase 1 Completed Features (v0.1.0)
- Email/password authentication (NextAuth + bcryptjs salt:12)
- Project CRUD + Dashboard + Sidebar (slate-900 dark theme)
- Task CRUD (PRJ-1 sequence ID, float sortOrder positioning)
- Labels and Assignees (M2M, deterministic avatar colors via bitwise hash)
- Kanban Board (@dnd-kit, intra-/inter-column drag-and-drop, Optimistic Updates + rollback)
- Task Detail Slide-over Panel (720px, inline editing, comments, permission checks)
- URL-based Filters (priority, label, assignee) + Sorting
- 14 Vitest tests (100% pass)
- git tag v0.1.0

## Phase 2 Completed Features (v0.2.0)
- **Sprint/Cycle:** DRAFT -> ACTIVE -> COMPLETED lifecycle, single active sprint constraint, sprint management page (`/projects/[id]/sprints`), SprintTaskPicker, completion dialog warning for incomplete tasks.
- **List View:** `/projects/[id]/list`, sortable column headers (title/priority/dueDate/createdAt/stateOrder), collapsible state grouping, ViewSwitcher (Board <-> List), FilterBar reuse.
- **Activity / Audit Log:** 15 ActivityTypes (TASK_CREATED, TASK_STATE_CHANGED, TASK_ASSIGNEE_ADDED, COMMENT_ADDED, etc.), every mutation logged inside `prisma.$transaction`, `formatActivityMessage` localized messages, Activity/Comments tabs in TaskDetailModal.
- **Bulk Actions:** List view multi-select checkboxes with "select all" (indeterminate support), BulkActionBar (bulk state/priority/sprint updates, bulk delete + ConfirmDialog), `bulkUpdateTasks`/`bulkDeleteTasks` server actions (limits: 100 update, 50 delete).
- **Markdown Support:** MarkdownEditor (Write/Preview tabs, auto-resize textarea, Tab->2 spaces, bold/italic/code/list/link toolbar), MarkdownRenderer (react-markdown + remark-gfm), Kanban card plain text snippet preview with stripMarkdown + truncateMarkdown.
- **Project Settings:** `/projects/[id]/settings` (ADMIN role only), StatesManager (drag-and-drop ordering, color picker, StateGroup badge, deletion constraints), LabelsManager (usage counter, inline editing), ColorPicker (hex <-> color input sync).
- 136 Vitest tests (100% pass), clean `npm run build`.

## Phase 3 Completed Features (v0.3.0)
- **[Q] Member Management & Project Invitation System:**
  - `ProjectInvite` model (token, email, role, `InviteStatus` enum: PENDING/ACCEPTED/EXPIRED, expiresAt 7 days).
  - 5 server actions (`src/actions/member.ts`): inviteMember, acceptInvite, removeMember, changeMemberRole, cancelInvite.
  - `/invite/[token]` page: token validation, email matching, login state handling — custom UI for each scenario.
  - `MembersManager` component: members table, role changing, member removal, pending invites, copy invite link.
  - Settings -> Members tab (added as the 3rd tab in SettingsTabs).
  - `member-management.test.ts` (28 tests).
- **[R] Task Detail Premium UX:**
  - `InlineSelectPopover` shared component + `StatusPicker`/`PriorityPicker` (keyboard navigation, mutation skipped if same value re-selected, optimistic updates + rollback).
  - `TaskProperties` compact grid layout, localized labels, empty placeholders (Unassigned, No Label, No Date), Sprint row (`resolveTaskSprintBadge`: ACTIVE > DRAFT > Backlog).
  - `DateField` (click-to-edit date picker), `CopyLinkButton` (window.location.origin based, 2-second "Copied!" badge), modal header breadcrumb ("Project Name / PRJ-12").
  - Board/List views support deep linking via `?task=` query parameter (shared link opens the task slide-over directly).
  - `getTaskDetail` query updated to include `project.name` and `sprints` relations.
  - `task-detail-ux.ts` (pure logic) + `task-detail-ux.test.ts` (19 tests).
- **[S] Backlog View & Sprint Integration:**
  - `/projects/[projectId]/backlog` route (protected by `requireMembership`).
  - Backlog definition: tasks not assigned to any ACTIVE or DRAFT sprint (`sprints: { none: { sprint: { status: { in: ["ACTIVE","DRAFT"] } } } }`).
  - `moveTaskToSprint` / `moveTaskToBacklog` server actions (`src/actions/sprint.ts`) — executed in `$transaction`, logs TASK_SPRINT_ADDED/TASK_SPRINT_REMOVED, never deletes COMPLETED sprint history (`getRemovableSprintIds` only targets ACTIVE/DRAFT links).
  - Active/Draft sprint overview cards (`SprintProgressCard`) + progress bar (`getSprintProgress` reused, division-by-zero handled for 0 tasks).
  - Backlog table: ID, Title, Status, Priority, Assignee avatars, "Move to Sprint" dropdown menu (`MoveToSprintMenu`), row click opens `TaskDetailModal`.
  - Sidebar Backlog link (Inbox icon), ViewSwitcher Backlog tab.
  - `backlog-logic.ts` (pure logic: isTaskInBacklog, canMoveTaskToSprint, canDeleteSprintTaskLink, getRemovableSprintIds, sortActiveDraftSprints) + `backlog-logic.test.ts` (23 tests).
- **[T] Global Search & Command Palette (Cmd+K):**
  - `globalSearch(query)` server action (`src/actions/search.ts`) — requires query >= 2 characters, returns tasks (title substring or PRJ-12 identifier match, max 10) and projects (name/identifier substring, max 5) across projects the user belongs to.
  - `search-logic.ts`: normalizeSearchQuery, isQueryValid, parseTaskIdentifier, matchesQuery, filterQuickNavCommands, moveActiveIndex (cyclic up/down navigation), flattenSearchResults/countTotalResults/hasNoResults.
  - `CommandPalette` component (`src/components/search/command-palette.tsx`): Ctrl+K / Cmd+K global shortcut, Escape to dismiss, categorized results (Projects / Tasks / Quick Actions), keyboard navigation + Enter to select, task selection deep links to `?task=`.
  - Quick Action navigation commands (Go to Board, List, Backlog, Sprints, Settings) shown only when viewing a project (extracted from `activeProjectId` in URL).
  - Compact "Search... (Ctrl+K)" button in Sidebar.
  - `search-logic.test.ts` (24 tests).
- **[U] Dashboard Refresh & Analytics:**
  - `analytics-logic.ts` (pure logic): isTaskOverdue / countOverdueTasks (only DONE is excluded, CANCELLED can still count as overdue), calculateCompletionRate (division-by-zero safe), calculateSprintBurndown(totalTasks, completedTasksByDate), calculateProjectVelocity (average completed tasks per sprint, rounded to 1 decimal place), formatRelativeTime(date, now?) — deduplicated and reused across components.
  - Dashboard (`/`) 4 statistic cards: Total Active Projects, Open Tasks Assigned to Me, Overdue Tasks, Active Sprints — all optimized via `prisma.count` (`src/components/dashboard/stats-overview.tsx`).
  - "Assigned to Me" widget: 5 most recent non-DONE open tasks, priority badge + overdue red alert, click deep links to `?task=` (`src/components/dashboard/my-tasks-widget.tsx`).
  - "Recent Activity" feed: last 8 activities across user's projects, formatActivityMessage + formatRelativeTime, click navigates to corresponding task board (`src/components/dashboard/recent-activity-feed.tsx`).
  - "Sprint Velocity" panel: CSS-based sprint progress bars (calculateCompletionRate) + remaining task count (calculateSprintBurndown) + average velocity (calculateProjectVelocity, last 10 completed sprints) — zero external chart libraries (`src/components/dashboard/sprint-metrics-panel.tsx`).
  - `dashboard-analytics.test.ts` (25 tests).
- **[V] Advanced Filters & Saved Views:**
  - `board-filters.ts` expanded: `BoardFilters { priorities, labelIds, assigneeIds, groups, due, query, sort, order }` — group (TODO/IN_PROGRESS/DONE/CANCELLED, BACKLOG excluded), due (overdue/today/this_week/no_date), q (search text).
  - `resolveDueDateRange`/`matchesDueFilter`: startOfDay/endOfDay/startOfWeek(Monday)/endOfWeek date boundaries; `buildTaskWhereFromFilters` compiles all filters into a single `Prisma.TaskWhereInput` (eliminated duplicated where-clause code).
  - `serializeBoardFilters`/`parseBoardFilters`: filter set <-> URL query string roundtrip.
  - `QuickFilterChips` (`src/components/filters/quick-filter-chips.tsx`): single-click toggle chips ("Assigned to Me", "Urgent", "Overdue", "Incomplete").
  - `GroupFilter`, `DueDateFilter`, `SearchInput`: multi-select state groups, date range selector, debounced search input.
  - `saved-views-logic.ts` (pure logic) + `use-saved-views.ts` (localStorage hook with key `pulse:saved-views:{projectId}`): save/delete/apply custom views via `SavedViewsMenu`; default views ("Default", "My Tasks", "Urgent") resolve `__me__` placeholder to current session user via `resolveSavedViewQuery`.
  - `advanced-filters.test.ts` (36 tests).
- **[W] Task Relations (Dependencies & Blocking Graph):**
  - `TaskRelation` model (sourceTaskId/targetTaskId/type, `@@unique([sourceTaskId, targetTaskId, type])`, `onDelete: Cascade`) + `RelationType` enum (BLOCKS/RELATES_TO/DUPLICATES) + `ActivityType` values TASK_RELATION_ADDED / TASK_RELATION_REMOVED (migration: `20260920004710_add_task_relations`, additive, non-destructive).
  - Single-directional storage: a relation is a SINGLE row in the DB; "Blocked by" is not a distinct enum type, but the target side's perspective of a BLOCKS record (reverse rows are never written).
  - `relation-logic.ts` (pure logic): getRelationLabel(type, direction), isSelfRelation, hasExistingRelation (single-pair rule regardless of direction or type), requiresCycleCheck (strictly for BLOCKS), collectBlockEdges, wouldCreateBlockCycle (iterative DFS with stack + visited set, non-recursive), groupRelationsForTask (blocks/blockedBy/relatesTo/duplicates), countGroupedRelations, formatTaskIdentifier.
  - 3 server actions (`src/actions/relation.ts`): addTaskRelation (forbids self-relations, enforces same-project validation derived from task record, checks duplicates & cycle detection, `$transaction` + `logActivity`), removeTaskRelation, searchTasksForRelation (excludes existing related tasks and self with `id: { notIn }`).
  - `getTaskDetail` includes `sourceRelations` and `targetRelations`.
  - `TaskRelations` component (`src/components/task-detail/task-relations.tsx`): 4-group perspective view (Blocks / Blocked By / Relates To / Duplicates), identifier badge + status color + hover delete X button (optimistic deletion with rollback), "Add Relation" popover (type selector + 250ms debounced task search).
  - Clicking a related task switches modal to that task (`onNavigateToTask`, syncing `?task=` in URL).
  - `task-relations.test.ts` (40 tests).
- Total Phase 3: 331 Vitest tests (100% pass).

## Phase 4 In-Progress Features (v0.4.0)
- **[Step 4.01] Realistic Analytics Dataset & Generators (v0.4.1):**
  - `seed-data-generators.ts`: Pure domain module, deterministic `mulberry32` PRNG (seed: 42), weighted task-type/priority distributions, GFM checklist (~40%) and simulated attachment link (~30%) generators, and 14-day sprint window calculators.
  - `seed-realistic-data.ts`: Idempotent bulk insertion script (`npm run db:seed-rich` via `prisma/tsconfig.seed.json`). Reuses `wouldCreateBlockCycle` and `hasExistingRelation` to guarantee zero dependency cycles, and preserves the backlog invariant (`isTaskInBacklog`).
  - Dataset counts: 10 user personas (all `password123`), 5 projects (`CORE`, `ANL`, `AI`, `ADM`, `MOB`), 40 states, 150 labels, 50 sprints, 500 tasks, 1,000 comments, 3,000 activities, 100 task relations.
  - `seed-data-generators.test.ts` (17 tests).
- **[Step 4.02] In-App Notifications with Client Polling (v0.4.2):**
  - `Notification` model & `NotificationType` enum (`TASK_ASSIGNED`, `COMMENT_ADDED`, `SPRINT_COMPLETED`).
  - `notification-logic.ts`: Pure functions for delivery checks (`shouldDeliverNotification` suppressing self-notifications), markdown stripping & snippet truncation (`formatNotificationSnippet`), deep link generation (`buildNotificationDeepLink`), and unread counting.
  - `notification.ts` server actions: `getNotifications`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`, with non-blocking `createNotification` helpers.
  - Event triggers integrated into `assignUserToTask`, `createComment`, and `completeSprint`.
  - Client polling hook (`useNotificationPolling`) with 30s interval and tab visibility awareness (`document.visibilityState`).
  - Header UI: `<NotificationBell />` with badge count and `<NotificationPopover />` with optimistic read status updates.
  - `notification-logic.test.ts` (16 tests).
- Total: 364 Vitest tests (100% pass).

## Critical Technical Invariants
- `requireMembership(projectId, userId)` -> Enforced in every server action.
- `requireAdmin(projectId, userId)` -> Enforced in settings/state actions (`role === "ADMIN"`).
- `getNextSequenceId(projectId, tx)` -> Generates project-scoped monotonically increasing IDs (`src/lib/sequence.ts`).
- `getAvatarColor(name)` -> Bitwise hash to one of 10 curated Tailwind palette colors (`src/lib/colors.ts`).
- `parseBoardFilters(searchParams)` -> URL params to `BoardFilters`; `buildTaskWhereFromFilters(filters)` -> single `Prisma.TaskWhereInput` (`src/lib/board-filters.ts`); `serializeBoardFilters` provides roundtrip URL query serialization.
- `useSavedViews(projectId, filters)` -> LocalStorage-backed saved views (`src/lib/use-saved-views.ts`, pure logic in `src/lib/saved-views-logic.ts`).
- Float Ordering: Insertion midpoint calculated via `(upper.sortOrder + lower.sortOrder) / 2`.
- `calculateStateSequences(count)` -> Produces spaced sequence offsets `[1000, 2000, ...]` (`src/lib/settings-logic.ts`).
- `logActivity(tx, data)` -> Wrapped in try/catch, non-blocking: audit logs never abort primary transactions (`src/lib/activity-logger.ts`).
- `sortTasksByField` / `groupTasksByState` -> Null due dates always sort last (`src/lib/list-view-sort.ts`).
- `useBulkSelection<T>(items)` -> Set-based multi-selection hook (`src/lib/bulk-selection-logic.ts`).
- `stripMarkdown` / `truncateMarkdown` -> Word-boundary clipping with balanced syntax (`src/lib/markdown-utils.ts`).
- `inviteMember` -> ADMIN check, `randomBytes(32).toString("hex")` token, 7-day expiration (`src/actions/member.ts`).
- `acceptInvite` -> Email matching required, creates `ProjectMember` and marks invite ACCEPTED inside `$transaction`.
- Project owner (`ownerId`) can never be removed or have their role altered.
- All mutations terminate with `revalidatePath()`.
- `globalSearch(query)` -> Parses `PRJ-12` formats via `parseTaskIdentifier`, combines title substring and identifier match via `OR`, strictly scoped to projects where user is a member.
- `isTaskOverdue(dueDate, stateGroup, now?)` -> Excludes only DONE state group (CANCELLED can count as overdue); `formatRelativeTime` provides localized relative timestamps (`src/lib/analytics-logic.ts`).
- `wouldCreateBlockCycle(edges, newSourceId, newTargetId)` -> When adding X BLOCKS Y, returns true if a path exists from Y back to X; non-recursive iterative DFS (`src/lib/relation-logic.ts`).
- `hasExistingRelation(existingRelations, a, b)` -> Prevents duplicate relations between any two tasks regardless of type or direction.

## Route Map
- `/`                       -> Dashboard (overview cards, Assigned to Me, Recent Activity, Sprint Velocity, project list)
- `/projects/[id]/board`    -> Kanban Board
- `/projects/[id]/list`     -> List View
- `/projects/[id]/backlog`  -> Backlog View (Phase 3-S)
- `/projects/[id]/sprints`  -> Sprint Management
- `/projects/[id]/settings` -> Project Settings (ADMIN only — States, Labels, Members)
- `/invite/[token]`         -> Project Invitation Acceptance Page (Phase 3-Q)
- `/login`                  -> Login Page
- `/register`               -> Registration Page

## Test Suite Distribution (331 Tests)
- `sequence.test.ts` (2)
- `sort-order.test.ts` (4)
- `colors.test.ts` (3)
- `board-filters.test.ts` (5)
- `sprint-utils.test.ts` (13)
- `sprint-actions.test.ts` (11)
- `list-view-sort.test.ts` (15)
- `activity-logger.test.ts` (14)
- `bulk-selection.test.ts` (18)
- `markdown-utils.test.ts` (21)
- `settings-validation.test.ts` (30)
- `member-management.test.ts` (28)
- `task-detail-ux.test.ts` (19)
- `backlog-logic.test.ts` (23)
- `search-logic.test.ts` (24)
- `dashboard-analytics.test.ts` (25)
- `advanced-filters.test.ts` (36)
- `task-relations.test.ts` (40)
- `seed-data-generators.test.ts` (17)
- `notification-logic.test.ts` (16)
Total: **364 tests, 100% passing**

## Mandatory Verification Commands
```bash
npm test          # Must pass 100% (364 tests)
npx tsc --noEmit  # Zero TypeScript errors
npm run build     # Production build validation
```

## New Chat Starter Template
```
Project: C:\Pulse - Pulse Project Manager (Next.js 16 + Prisma + PostgreSQL project management platform)
Phases 1 (v0.1.0), 2 (v0.2.0), and 3 (v0.3.0) are fully completed; Phase 4.01 (Dataset) and Phase 4.02 (In-App Notifications) are complete.
364 Vitest tests are passing 100%.
We are now ready to implement [new phase / feature].
[Paste specific task or requirements here]
```
