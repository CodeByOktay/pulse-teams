# Pulse — Seed Dataset & Analytics Mock Architecture

## Overview
Pulse contains a deterministic, reproducible, and relational seed dataset designed to empower realistic development and upcoming analytics dashboards (Sprint Velocity, Burndown, Lead/Cycle Time, Workload Heatmap) without manual data entry.

- **Command:** `npm run db:seed-rich`
- **Configuration:** `prisma/tsconfig.seed.json` (avoids Windows cmd quote-stripping)
- **Generator Core:** `prisma/seed-data-generators.ts` (pure domain module, `mulberry32` PRNG with seed 42)
- **Orchestrator:** `prisma/seed-realistic-data.ts` (Prisma transaction / `createMany` batching)
- **Test Suite:** `src/lib/__tests__/seed-data-generators.test.ts` (17 Vitest tests)

---

## Seed Personas (10 Users)
All accounts use the shared bcrypt password: `password123` (salt: 12).

| Name | Email | Role | Title | Focus Domain |
|---|---|---|---|---|
| Ahmet Yılmaz | `admin@pulse.local` / `ahmet@pulse.local` | `ADMIN` | Product Owner | Project Owner across all 5 projects |
| Ayşe Kaya | `ayse@pulse.local` | `MEMBER` | Scrum Master | Sprint governance & process labels |
| Mehmet Demir | `mehmet@pulse.local` | `MEMBER` | Engineering Manager | Backlog refinement & resource allocation |
| Zeynep Çelik | `zeynep@pulse.local` | `MEMBER` | Senior Backend Dev | Architecture, Database & Prisma |
| Can Arslan | `can@pulse.local` | `MEMBER` | Backend Dev | APIs, caching & auth |
| Burak Şahin | `burak@pulse.local` | `MEMBER` | Backend Dev | Performance & security |
| Elif Aydın | `elif@pulse.local` | `MEMBER` | Lead Frontend Dev | Next.js 16, React 19 & Tailwind v4 |
| Mert Aksoy | `mert@pulse.local` | `MEMBER` | Frontend Dev | Components, @dnd-kit & UI/UX |
| Seda Korkmaz | `seda@pulse.local` | `MEMBER` | QA Engineer | Test automation, regression & bug reporting |
| Emre Eren | `emre@pulse.local` | `MEMBER` | DevOps / SRE | Docker, CI/CD & deployment |

---

## Projects (5 Projects — 500 Tasks Total)
All 10 users are added as `ProjectMember` to every project.

| Project Name | Identifier | Task Count | Description |
|---|---|---|---|
| **Pulse Core Platform** | `CORE` | 120 | Foundational Kanban, sequence IDs, task CRUD, and auth |
| **Pulse Analytics** | `ANL` | 100 | Velocity, Burndown, KPI cards, and activity metrics |
| **Pulse AI Assistant** | `AI` | 90 | LLM integrations, prompt engineering, task summaries |
| **Pulse Administration** | `ADM` | 110 | RBAC, project settings, invitations, states & audit logs |
| **Pulse Mobile Experience** | `MOB` | 80 | Responsive layouts, touch interactions, fast slide-overs |

---

## States & Kanban Columns (8 States per Project)
Mapped to the 5 semantic `StateGroup` enums:
1. `Backlog` (`BACKLOG`, sequence: 10000, color: `#60646C`, `isDefault: true`)
2. `Ready` (`TODO`, sequence: 20000, color: `#3A3F47`)
3. `In Progress` (`IN_PROGRESS`, sequence: 30000, color: `#3B82F6`)
4. `Code Review` (`IN_PROGRESS`, sequence: 40000, color: `#8B5CF6`)
5. `Testing` (`IN_PROGRESS`, sequence: 50000, color: `#F59E0B`)
6. `Blocked` (`TODO`, sequence: 60000, color: `#EF4444`)
7. `Done` (`DONE`, sequence: 70000, color: `#10B981`)
8. `Cancelled` (`CANCELLED`, sequence: 80000, color: `#94A3B8`)

### State Distribution across 500 Tasks:
- **Backlog:** 120 (strictly unassigned to active/draft sprints; `isTaskInBacklog` compliant)
- **Ready:** 60
- **In Progress:** 70
- **Code Review:** 40
- **Testing:** 50
- **Blocked:** 20 (blocked by uncompleted tasks via `BLOCKS` relations; cycle-safe)
- **Done:** 130
- **Cancelled:** 10

---

## Sprints & Temporal Distribution (Jan 1 – May 20)
- **10 Sprints per Project:** 2-week intervals covering 140 days.
- **Single Active Sprint Invariant:** Each project has:
  - 8 `COMPLETED` sprints (past sprints with completed task history)
  - 1 `ACTIVE` sprint (current active sprint)
  - 1 `DRAFT` sprint (future sprint)
- **3,000 Activities:** Realistic historical timeline tracing `TASK_CREATED`, `TASK_STATE_CHANGED`, `COMMENT_ADDED`, `TASK_ASSIGNEE_ADDED`, and `TASK_RELATION_ADDED` to power authentic Burndown, Velocity, and Lead/Cycle Time calculations.
