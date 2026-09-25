# Pulse Project Manager — AI Context & Architecture Snapshot

## System Metadata
- **Project Name:** Pulse (Pulse Project Manager)
- **Version:** v0.5.2 (Phase 5 in progress — Step 5.02 completed)
- **Stack:** Next.js 16 (App Router, Turbopack) + TypeScript (Strict) + Prisma v6.19.3 + PostgreSQL 16 + Tailwind CSS v4 + @dnd-kit + Vitest v5 + Nodemailer
- **Auth Strategy:** NextAuth.js v4 (Strictly CredentialsProvider: email/password + bcryptjs salt:12, JWT session). External OAuth is explicitly out of scope.
- **Database Models (16):** User, Project, ProjectMember, State, Task, Label, TaskLabel, TaskAssignee, Comment, Sprint, SprintTask, Activity (with `isAiGenerated`), ProjectInvite, TaskRelation, Notification, UserNotificationPreference.
- **Enums (7):** StateGroup, Priority, SprintStatus, ActivityType (23 values), InviteStatus, RelationType (BLOCKS, RELATES_TO, DUPLICATES), NotificationType (7 values).
- **Test Suite:** 468 tests passing across 24 test suites in `src/lib/__tests__/` (100% pass rate).
- **Seeding Infrastructure:** Idempotent, deterministic rich mock data generator (`npm run db:seed-rich` via `prisma/tsconfig.seed.json`) supporting upcoming analytics with 10 users, 5 projects, 40 states, 50 sprints, 500 tasks, 1,000 comments, 3,000 activities, and 100 relations.

---

## Architectural Principles & Invariants
1. **Separation of Concerns between AI Agents:**
   - **Antigravity (Lead Architect & QA Authority):** Evaluates features, conducts trade-off analyses, creates implementation plans, generates execution prompts for Claude (Turkish review -> English execution), exclusive author of all tests (`src/lib/__tests__/*.test.ts`), validates test outcomes, generates ADRs (`docs/wiki/ADR-xxx.md`), and updates this AI context.
   - **Claude Code (Builder & Subagent Orchestrator):** Implements features across DB, server actions, and UI via subagents (`postgres-pro`, `backend-developer`, `react-specialist`, `nextjs-developer`, `debugger`). Does NOT write tests; runs tests provided by Antigravity and fixes code without modifying test files.
2. **Pure Business Logic Isolation:**
   - All complex logic (cycle detection, filter query composition, sorting, permission algorithms, formatting, seed generators, email templating) MUST reside in pure functions under `src/lib/` or modular generators (e.g. `relation-logic.ts`, `board-filters.ts`, `analytics-logic.ts`, `seed-data-generators.ts`, `email-templates.ts`).
   - Server Actions and route handlers in `src/actions/` and `src/app/api/` only handle authentication, authorization (`requireMembership`), transactions (`prisma.$transaction`), and calling pure domain logic.
3. **Data Integrity & Safety:**
   - Float-based ordering for states and tasks (`sortOrder`).
   - Monotonically increasing project sequence IDs (`PRJ-1`, `PRJ-2`).
   - Cycle detection: iterative DFS stack implementation (`wouldCreateBlockCycle`) preventing infinite loops on task blocking relationships, strictly reused across both app logic and seed scripts.
   - Activity audit trail: all state/assignee/priority/comment/relation changes are recorded within transactions.
   - Single active sprint constraint: at most one `ACTIVE` sprint per project (`canStartSprint`).
   - Backlog invariant: tasks not assigned to any ACTIVE or DRAFT sprint (`isTaskInBacklog`).
   - Non-blocking resilient email dispatch: auth registration succeeds regardless of SMTP latency or transport errors.

---

## Completed Phases Overview
- **Phase 1 (v0.1.0):** Core Kanban, Task CRUD, Sequence ID, Auth, Labels, Slide-over panel. (14 tests)
- **Phase 2 (v0.2.0):** Sprints/Cycles (Draft->Active->Completed), List View, Audit Log, Bulk Actions, Markdown Editor & Renderer, Project Settings. (+122 -> 136 tests)
- **Phase 3 (v0.3.0):** Member Management & Invite Tokens, Task Detail UX (inline popovers, deep linking), Backlog View, Global Search (Cmd+K Command Palette), Analytics Dashboard, Advanced Filters & Saved Views, Task Relations (dependency graph & cycle prevention). (+195 -> 331 tests)
- **Phase 4 (v0.4.0 — Completed):**
  - **Step 4.01 (v0.4.1):** Realistic Analytics Dataset & Generators (`seed-data-generators.test.ts`). (+17 -> 348 tests)
  - **Step 4.02 (v0.4.2):** In-App Notifications with Client Polling, Triggers & Popover UI (`notification-logic.test.ts`). (+16 -> 364 tests)
  - **Step 4.03 (v0.4.3):** User Notification Preferences, Mention Detection (@user) & Approaching Due Date Alerts (`notification-preferences.test.ts`). (+29 -> 393 tests)
  - **Step 4.04 (v0.4.4):** Email Delivery Service, Welcome & Invite Member Email, Universal sendEmail (`email-templates.test.ts`). (+23 -> 416 tests)
- **Phase 5 (v0.5.0 — In Progress): AI Proactive Project Coordination**
  - **Step 5.00 (v0.5.0):** Architecture Decisions & ADR-028 (416 tests)
  - **Step 5.01 (v0.5.1):** Domain Event Foundation, ActivityType/NotificationType expansion, `automation-logic.ts` (+32 -> 448 tests)
  - **Step 5.02 (v0.5.2):** TASK_UNBLOCKED Dependency Automation & Notification (+20 -> 468 tests)
  - **Step 5.03 (v0.5.3):** ProgressRequest/ProgressResponse Lifecycle (target: ~488 tests)
  - **Step 5.04 (v0.5.4):** AI Progress Interpretation, AgentProposal, Human Approval UI (target: ~508 tests)
- **ADR Index:** 30 Architecture Decision Records stored in `docs/wiki/ADR-001` through `ADR-030`.
- **Detailed AI Context Snapshots:**
  - `024-seed-dataset-architecture.md` (ADR-024) — Seed personas, project scopes, state mappings, and dataset architecture.
  - `025-in-app-notifications.md` (ADR-025) — In-app notification polling and trigger hooks.
  - `026-notification-preferences-and-mentions.md` (ADR-026) — Notification preferences, mention parsing, and due date alerts.
  - `027-email-service-and-welcome-email.md` (ADR-027) — Resilient email dispatch engine and welcome email templates.
  - `028-ai-proactive-coordination-architecture.md` (ADR-028) — Three-tier AI coordination, domain event foundation, and dependency automation.
  - `029-domain-event-foundation.md` (ADR-029) — Domain event foundation, enum expansions, and pure automation logic.
  - `030-dependency-automation.md` (ADR-030) — Task dependency unblocking automation and in-app notifications.

