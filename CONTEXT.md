# CONTEXT - Pulse Project Manager (v0.6.7 -> Phase 6 Step 6.08 Completed: Multi-Agent Coordination Consolidation & Hardening)
Paste this file into a new AI chat. The agent will immediately grasp the full project context.

## What is the Project?
Pulse Project Manager. A modern, full-featured Kanban and Sprint-based project management platform. Phases 1, 2, 3, 4, Phase 5 MVP (AI Coordination, Progress Interpretation, AgentProposal), and Phase 6 (AI Agent Coordination System: Steps 6.01 through 6.08 — Agents 000–009, RAG Semantic Search with pgvector, Slot Replay, Time Travel Security, and Multi-Agent Coordination Consolidation) are 100% completed.

## Location & Execution
- **Project Path:** repository root
- **Database:** PostgreSQL 16 with pgvector in Docker (`docker start pulse-postgres`, port 5432)
- **Dev Server:** `npm run dev` -> `http://localhost:3000`
- **Tests:** `npm test` (740 Vitest tests across 39 suites + 98 Pytest tests across 17 suites = 838 tests, 100% passing)
- **Seed Rich Data:** `npm run db:seed-rich` (10 users, 5 projects, ~60 tasks compact dataset, active/draft sprints)

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

## Phase 4 Completed Features (v0.4.0)
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
- **[Step 4.03] Notification Preferences, Mentions & Due Date Alerts (v0.4.3):**
  - `UserNotificationPreference` model & `NotificationType` extension (`TASK_MENTIONED`, `DUE_DATE_APPROACHING`).
  - `notification-logic.ts`: Pure functions for mention parsing (`extractMentions`, `resolveMentionedUserIds`), preference-aware delivery checks (`shouldDeliverWithPreferences`), calendar-day threshold calculations (`getApproachingDueTasks` for 0, 1, 3 days), and localized formatting (`formatDueDateNotificationSnippet`).
  - `notification.ts` server actions: `getUserNotificationPreferences`, `updateUserNotificationPreferences`, and `checkApproachingDueDates` with same-day deduplication.
  - `comment.ts`: Dispatches `TASK_MENTIONED` to mentioned project members and suppresses `COMMENT_ADDED` for mentioned assignees to prevent duplicate notifications.
  - UI: `NotificationPreferencesModal` with 5 switches, optimistic state & rollback; gear icon in `NotificationPopover`; `AtSign` & `Clock` icons in `NotificationItem`.
  - `notification-preferences.test.ts` (29 tests).
- **[Step 4.04] Email Delivery Service & Templates (v0.4.4):**
  - `sendEmail` universal engine (`src/lib/mail.ts`) with live SMTP, Ethereal testing, and console fallback.
  - HTML templates: `renderWelcomeEmail` and `renderInviteMemberEmail` (`src/lib/email-templates.ts`).
  - `email-templates.test.ts` (23 tests).
- Total Phase 4: 416 Vitest tests (100% pass).

## Phase 5 Completed Features (v0.5.0 MVP — AI Proactive Project Coordination)
- **[Step 5.00] Architecture Decisions & ADR-028:** Three-tier coordination, domain events, provider-agnostic AI engine.
- **[Step 5.01] Domain Event Foundation (v0.5.1):** Enums expanded (`ActivityType` to 23 values, `NotificationType` to 7 values); `automation-logic.ts` (32 tests).
- **[Step 5.02] Dependency Automation (v0.5.2):** `TASK_UNBLOCKED` automatic notifications when blocking tasks are completed; `dependency-automation.test.ts` (13 tests).
- **[Step 5.03] Progress Request & Response Lifecycle (v0.5.3):** `ProgressRequest` and `ProgressResponse` models, interactive response slide-over, token validation; `progress-logic.test.ts` (20 tests).
- **[Step 5.04] AI Progress Interpretation & Agent Proposals (v0.5.4):** Structured progress extraction, `AgentProposal` approval workflow, human-in-the-loop review UI (`AgentProposalCard`); `ai-proposal-logic.test.ts` (26 tests).
- **4-Wave Full-Stack Refactoring & Hardening (v0.5.4):**
  - Wave 1 (Domain Logic): Analytics optimization, pure cycle detection helpers, and `project-analytics-logic.test.ts` (14 tests). Total: 553 tests.
  - Wave 2 (Server Actions & Auth): Cross-tenant invite IDOR fix, pre-transaction proposal checks.
  - Wave 3 (Kanban & Modals): React 19 render-phase state sync, rapid task navigation race condition fix.
  - Wave 4 (Project Settings): Optimistic renames with rollback, clipboard error handling, timeout leak cleanup.
- **Post-MVP Hardening Packages (v0.5.4):**
  - Package 1: Centralized `src/lib/authz.ts` (12 action files), cross-project state/assignee validation in `task.ts`, invite expiration filters.
  - Package 2: Unified `src/lib/use-task-navigation.ts` hook, modal Escape isolation in `EditableTitle`/popovers, single-state delete prevention.
  - Package 3: Atomic `updateMany` concurrency guard in `completeSprint`, resilient try/catch notifications, 200ms `ColorPicker` debounce, shared `InlineNameInput`.

## Phase 6 Completed Features: AI Agent Coordination System (v0.6.0 — v0.6.2)
- **Architecture (ADR-034):** Python LangGraph container (`pulse-agent`) + PostgreSQL DomainEvent outbox + HMAC-SHA256 Internal API. The entire 10-agent catalog (Agent-000 through Agent-009) belongs strictly to Phase 6.
- **[Step 6.01] Agent Infrastructure (v0.6.0):** `DomainEvent`, `AgentRun`, `AgentSettings` Prisma models, testable Clock abstraction (`src/lib/clock.ts` and `agent/src/clock.py`), Python container with APScheduler, `Agent-000` Supervisor, HMAC Internal API (`src/app/api/internal/agent/`), AgentSettings project tab UI (574 tests).
- **[Step 6.02] Agent-001 Deadline Tracker & Activity Widget (v0.6.1):** Session-independent `dispatchDueDateReminders`, approaching/overdue reminders + ADMIN escalation, dashboard "Agent Activity" widget (587 tests).
- **[Step 6.03] Agent-002 Task Hygiene & Agent-003 Status Requester (v0.6.2):**
  - `Agent-002` (Task Hygiene): Missing assignee, missing due date, missing description detection; notifies assignee or PM user with hygiene action links (`hygiene-logic.ts`, `hygiene-service.ts`, `test_agent_002.py`).
  - `Agent-003` (Status Requester): Stale in-progress task inquiry; LangGraph `interrupt()`/`resume()` with interactive action buttons (İlerliyor ▶, Engel var 🚫, Bitti ✅), timeout-based ADMIN escalation, `status-response` endpoint (`status-requester-logic.ts`, `status-requester-service.ts`, `test_agent_003.py`). Total: 653 tests (605 Vitest + 48 Pytest, 100% passing).

## Critical Technical Invariants
- Centralized authz: all actions delegate authorization to `src/lib/authz.ts` (`requireMembership`, `requireAdmin`, `requireSession`, `assertNotProjectOwner`).
- Unified navigation: `useTaskNavigation` hook standardizes `?task=` URL state synchronization across board, list, and backlog views.
- Atomic concurrency guards: `completeSprint` uses `updateMany({ where: { id, status: "ACTIVE" } })` to eliminate double-completion races; notifications dispatched in try/catch.
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
- `shouldDeliverWithPreferences` -> Self-notifications unconditionally blocked (`actorId !== recipientId`), maps `NotificationType` to recipient `UserNotificationPreference` toggles.
- `sendEmail` / `sendWelcomeEmail` / `sendInviteMemberEmail` -> Non-blocking, Nodemailer-powered universal mail engine (live SMTP / Brevo / Ethereal / console fallback), XSS-safe HTML templates (`src/lib/mail.ts`, `src/lib/email-templates.ts`).

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

## Test Suite Distribution (740 Vitest Tests across 39 Suites + 98 Pytest Tests across 17 Suites = 838 Tests)
- `sequence.test.ts` (2)
- `sort-order.test.ts` (4)
- `colors.test.ts` (3)
- `board-filters.test.ts` (5)
- `sprint-utils.test.ts` (13)
- `sprint-actions.test.ts` (11)
- `list-view-sort.test.ts` (15)
- `activity-logger.test.ts` (20)
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
- `notification-preferences.test.ts` (29)
- `email-templates.test.ts` (23)
- `automation-logic.test.ts` (33)
- `dependency-automation.test.ts` (13)
- `progress-logic.test.ts` (20)
- `ai-proposal-logic.test.ts` (26)
- `project-analytics-logic.test.ts` (14)
- `agent-infrastructure.test.ts` (15)
- `deadline-tracker.test.ts` (10)
- `hygiene-logic.test.ts` (20)
- `status-requester-logic.test.ts` (19)
- `clock-app.test.ts` (11)
- `version.test.ts` (2)
- `blocker-logic.test.ts` (11)
- `scope-creep-logic.test.ts` (5)
- `standup-logic.test.ts` (26)
- `weekly-digest-logic.test.ts` (22)
- `semantic-search.test.ts` (55)
- `multi-agent-coordination.test.ts` (16)
- `agent/tests/`: `test_clock.py` (3), `test_config.py` (4), `test_internal_client.py` (7), `test_poller.py` (10), `test_supervisor.py` (7), `test_agent_001.py` (3), `test_agent_002.py` (3), `test_agent_003.py` (5), `test_clock_sync.py` (6), `test_agent_004.py` (4), `test_agent_009.py` (4), `test_agent_005.py` (8), `test_agent_006.py` (7), `test_agent_007.py` (5), `test_agent_008.py` (7), `test_replay.py` (9), `test_e2e_coordination.py` (6)
Total: **740 Vitest tests (TypeScript) + 98 Pytest tests (Python) = 838 tests, 100% passing**

## Database Models (26 Pulse Models + 4 LangGraph Checkpoint Models = 30 Total in DB)
User, Project, ProjectMember, State, Task, Label, TaskLabel, TaskAssignee, Comment,
Sprint, SprintTask, Activity, ProjectInvite, TaskRelation, Notification, UserNotificationPreference,
ProgressRequest, ProgressResponse, AgentProposal, DomainEvent, AgentRun, AgentSettings, SystemClock,
DailyStandup, StandupEntry, **TaskEmbedding**

## Detailed AI Context Snapshots (`docs/ai-context/`)
- `024-seed-dataset-architecture.md` (ADR-024) — Seed personas, project scopes, state mappings, and dataset architecture.
- `025-in-app-notifications.md` (ADR-025) — In-app notification polling and trigger hooks.
- `026-notification-preferences-and-mentions.md` (ADR-026) — Notification preferences, mention parsing, and due date alerts.
- `027-email-service-and-welcome-email.md` (ADR-027) — Resilient email dispatch engine and welcome email templates.
- `028-ai-proactive-coordination-architecture.md` (ADR-028) — Three-tier AI coordination, domain event foundation, and dependency automation.
- `029-domain-event-foundation.md` (ADR-029) — Domain event foundation, enum expansions, and pure automation logic.
- `030-dependency-automation.md` (ADR-030) — Task dependency unblocking automation and in-app notifications.
- `031-progress-request-response-lifecycle.md` (ADR-031) — Interactive progress collection lifecycle and response validation.
- `032-ai-progress-interpretation-and-proposals.md` (ADR-032) — AI progress interpretation, AgentProposal, and human approval flow.
- [`033-codebase-refactoring-and-architecture-hardening.md`](./033-codebase-refactoring-and-architecture-hardening.md) (ADR-033) — 4-wave refactoring, 3 targeted hardening packages (authz, modal UX, concurrency), React 19 / ESLint hydration fixes, and project analytics test suite.
- [`034-ai-agent-coordination-infrastructure.md`](./034-ai-agent-coordination-infrastructure.md) (ADR-034) — Python LangGraph container, DomainEvent outbox, APScheduler, 10-agent catalog (Agent-000 through Agent-009), HMAC-protected Internal API, Clock abstraction, and catch-up on startup.
- [`035-project-memory-and-rag-semantic-search.md`](./035-project-memory-and-rag-semantic-search.md) (ADR-035) — Project Memory, PostgreSQL pgvector integration, TaskEmbedding model, ivfflat indexing, SHA-256 content hashing, hybrid search ranking, and Similar Tasks UI.
- [`036-slot-replay-and-time-travel-security.md`](./036-slot-replay-and-time-travel-security.md) (ADR-036) — Slot Replay engine, time travel security gating, unblock deduplication with advisory lock, and poller resilience.

## Phase 6 Full 10-Agent Catalog & Roadmap (All Agents in Phase 6)
- **Agent-000 (Supervisor):** Routing, rate-limiting, dedup, run logging (Step 6.01, Completed)
- **Agent-001 (Deadline Tracker):** Approaching & overdue reminders + ADMIN escalation (Step 6.02, Completed)
- **Agent-002 (Task Hygiene):** Missing assignee/due date/description detection (Step 6.03, Completed)
- **Agent-003 (Status Requester):** Stale task inquiry with interrupt/resume buttons (Step 6.03, Completed)
- **Agent-004 (Blocker Manager):** Dependency chain tracking (BLOCKS) + escalation (Step 6.04, Completed)
- **Agent-009 (Scope Creep Detection):** Mid-sprint scope growth & task addition detection (Step 6.04, Completed)
- **Agent-005 (Async Standup):** Morning standup form + LLM summary digest (Step 6.05, Completed)
- **Agent-006 (Weekly Report):** Sprint health, velocity & risk summary (Step 6.05, Completed)
- **Agent-007 (Workload Balancer):** Overload/idle detection + reassignment AgentProposal (Step 6.06, Completed)
- **Agent-008 (Sprint Assistant):** Sprint overflow warning + retro draft (Step 6.06, Completed)
- **Project Memory & RAG:** Semantic search on tasks, comments & project docs via pgvector (Step 6.07, Completed)
- **Phase 6 Consolidation & Verification:** E2E multi-agent verification & hardening (Step 6.08, Completed)

## Mandatory Verification Commands
```bash
npm test          # Must pass 100% (740 Vitest tests)
npx tsc --noEmit  # Zero TypeScript errors
cd agent && .venv\Scripts\pytest # Must pass 100% (98 Python tests)
npm run build     # Production build validation
```

## New Chat Starter Template
```
Project: Pulse - Pulse Project Manager (Next.js 16 + Prisma + PostgreSQL project management platform)
Phases 1 (v0.1.0), 2 (v0.2.0), 3 (v0.3.0), 4 (v0.4.0), 5 MVP (v0.5.4), and Phase 6 (v0.6.7, complete 10-agent proactive multi-agent system) are fully completed.
838 tests (740 Vitest + 98 Pytest) are passing 100%. 26 Pulse DB models (+ 4 checkpoint models), 9 enums.
[Paste specific task or requirements here]
```
