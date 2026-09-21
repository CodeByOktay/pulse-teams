# Pulse Project Manager — AI Context & Architecture Snapshot

## System Metadata
- **Project Name:** Pulse (Pulse Project Manager)
- **Version:** v0.3.0 (Phases 1, 2, and 3 fully completed)
- **Stack:** Next.js 16 (App Router, Turbopack) + TypeScript (Strict) + Prisma v6.19.3 + PostgreSQL 16 + Tailwind CSS v4 + @dnd-kit + Vitest v5
- **Auth Strategy:** NextAuth.js v4 (Strictly CredentialsProvider: email/password + bcryptjs salt:12, JWT session). External OAuth is explicitly out of scope.
- **Database Models (14):** User, Project, ProjectMember, State, Task, Label, TaskLabel, TaskAssignee, Comment, Sprint, SprintTask, Activity, ProjectInvite, TaskRelation.
- **Enums (6):** StateGroup, Priority, SprintStatus, ActivityType (17 values), InviteStatus, RelationType (BLOCKS, RELATES_TO, DUPLICATES).
- **Test Suite:** 331 tests passing across 18 test suites in `src/lib/__tests__/`.

---

## Architectural Principles & Invariants
1. **Separation of Concerns between AI Agents:**
   - **Antigravity (Lead Architect & QA Authority):** Evaluates features, conducts trade-off analyses, creates implementation plans, generates execution prompts for Claude, writes all tests (`src/lib/__tests__/*.test.ts`), validates test outcomes, generates ADRs (`docs/wiki/ADR-xxx.md`), and updates this AI context.
   - **Claude Code (Builder & Subagent Orchestrator):** Implements features across DB, server actions, and UI via subagents (`postgres-pro`, `backend-developer`, `react-specialist`, `nextjs-developer`, `debugger`). Does NOT write tests; runs tests provided by Antigravity and fixes code without modifying test files.
2. **Pure Business Logic Isolation:**
   - All complex logic (cycle detection, filter query composition, sorting, permission algorithms, formatting) MUST reside in pure functions under `src/lib/` (e.g. `relation-logic.ts`, `board-filters.ts`, `analytics-logic.ts`).
   - Server Actions in `src/actions/` only handle authentication, authorization (`requireMembership`), transactions (`prisma.$transaction`), and calling pure domain logic.
3. **Data Integrity & Safety:**
   - Float-based ordering for states and tasks (`sortOrder`).
   - Monotonically increasing project sequence IDs (`PRJ-1`, `PRJ-2`).
   - Cycle detection: iterative DFS stack implementation (`wouldCreateBlockCycle`) preventing infinite loops on task blocking relationships.
   - Activity audit trail: all state/assignee/priority/comment/relation changes are recorded within transactions.

---

## Completed Phases Overview
- **Phase 1 (v0.1.0):** Core Kanban, Task CRUD, Sequence ID, Auth, Labels, Slide-over panel.
- **Phase 2 (v0.2.0):** Sprints/Cycles (Draft->Active->Completed), List View, Audit Log, Bulk Actions, Markdown Editor & Renderer, Project Settings.
- **Phase 3 (v0.3.0):** Member Management & Invite Tokens, Task Detail UX (inline popovers, deep linking), Backlog View, Global Search (Cmd+K Command Palette), Analytics Dashboard, Advanced Filters & Saved Views, Task Relations (dependency graph & cycle prevention).
- **ADR Index:** 23 Architecture Decision Records stored in `docs/wiki/ADR-001` through `ADR-023`.
