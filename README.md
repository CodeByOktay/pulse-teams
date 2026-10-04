# Pulse

> Modern, high-performance Kanban & Sprint management platform with proactive AI project coordination.

[![CI](https://github.com/CodeByOktay/Pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeByOktay/Pulse/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-v0.6.7-blue.svg)](https://github.com/CodeByOktay/Pulse)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?logo=postgresql)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B%20%C2%B7%20LangGraph-3776AB?logo=python)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-740%20Vitest%20%2B%2098%20Pytest-success?logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Overview

Pulse is a developer-centric, full-featured project management platform designed for agile software teams. Built with Next.js 16 and PostgreSQL, it delivers sub-millisecond local interactions, fluid drag-and-drop workflows, and deterministic business logic.

Beyond traditional project tracking, Pulse introduces **Proactive AI Coordination**: an approval-gated, three-tier automation system that detects resolved task dependencies, collects progress reports from team members, interprets natural language status updates, and proposes Kanban/Sprint mutations under human control. A separate Python **LangGraph** service runs a catalog of ten coordination agents (deadlines, task hygiene, blockers, standups, weekly digests, workload balancing, sprint assistance) driven by a PostgreSQL event outbox.

---

## Features

- **Interactive Kanban Board:** Fluid vertical and cross-column drag-and-drop powered by `@dnd-kit`, optimistic UI updates with automatic server rollback, and $O(1)$ float-based midpoint sorting (`sortOrder`).
- **Sprint & Cycle Lifecycle:** Full Draft $\rightarrow$ Active $\rightarrow$ Completed sprint transitions, atomic concurrency guards against double-completion races, and single-active-sprint constraints.
- **Alternative Views:** Collapsible, sortable tabular List View and dedicated Backlog View that preserves completed sprint history.
- **Slide-Over Task Panel:** 720px detail drawer featuring inline markdown editing, deterministic avatar color hashing, and deep-linkable URLs (`?task=PRJ-X`).
- **Task Dependencies & Cycle Prevention:** Unidirectional dependency graph (`BLOCKS`, `RELATES_TO`, `DUPLICATES`) with iterative DFS cycle detection preventing infinite loops.
- **Global Search & Command Palette:** Global `Ctrl+K` / `Cmd+K` palette with cyclic keyboard navigation and context-aware quick actions across member projects.
- **Dashboard Analytics:** CSS-only sprint velocity bars, completion rate calculations, overdue task alerts, and recent audit activity feed without external charting bloat.
- **In-App & Email Notifications:** 30-second tab-aware notification polling, `@mention` parsing, calendar-day due date alerts (0, 1, 3 days), and non-blocking Nodemailer delivery for invites and welcomes.
- **AI Proactive Coordination:**
  - Automated `TASK_UNBLOCKED` domain event notifications upon blocker resolution.
  - Interactive `ProgressRequest` / `ProgressResponse` lifecycle.
  - Natural language status extraction producing structured `AgentProposal` candidates.
  - Human-in-the-loop approval UI (`AgentProposalCard`) with audit trail logging (`isAiGenerated`).
- **Multi-Agent Coordination Service (Python + LangGraph):**
  - `DomainEvent` outbox consumed with `FOR UPDATE SKIP LOCKED` leases; APScheduler cron with startup catch-up.
  - Agent-000 Supervisor (routing, per-project enablement, idempotent `AgentRun` logging) and Agents 001–009: Deadline Tracker, Task Hygiene, Status Requester (LangGraph `interrupt()`/resume), Blocker Manager, Async Standup, Weekly Digest, Workload Balancer, Sprint Assistant, Scope Creep Detection.
  - HMAC-SHA256 signed Internal API between the agent service and Next.js.
  - Testable clock abstraction with Slot Replay for simulated time travel (development only).
- **Project Memory & Semantic Search:** `pgvector` embeddings with SHA-256 content hashing and hybrid vector/text ranking, falling back to text search when no embedding provider is configured.
- **Project Settings & RBAC:** Admin-governed state pipelines, custom color-coded labels, and role-based project member access control.

---

## Screenshots

Captured from the seeded demo dataset (`npm run db:seed-rich`).

| Kanban Board | Task Detail Slide-Over |
| :---: | :---: |
| ![Kanban board with filter chips and saved views](docs/screenshots/board.png) | ![Task detail panel with markdown editor, relations and activity](docs/screenshots/task-detail.png) |

| Dashboard | Sprint Management |
| :---: | :---: |
| ![Dashboard with stat cards, assigned tasks and recent activity](docs/screenshots/dashboard.png) | ![Sprint list with active, draft and completed sprints](docs/screenshots/sprints.png) |

| List View | Command Palette (Ctrl+K) |
| :---: | :---: |
| ![Sortable list view grouped by state](docs/screenshots/list.png) | ![Command palette searching tasks and quick actions](docs/screenshots/command-palette.png) |

> **Language note:** The application UI, the ADRs under `docs/wiki/`, the specs under `docs/spec/`, and some code comments are written in Turkish. This README, the code identifiers, and the commit history are in English.

---

## Architecture

Pulse enforces a strict separation of concerns across its application layers:

```
[ Next.js 16 App Router (RSC + Client Components) ]
                      │
                      ▼
[ Centralized Authorization Guard (src/lib/authz.ts) ]
                      │
                      ▼
[ Server Actions Layer (src/actions/) - "use server" ]
       │                                     │
       ▼                                     ▼
[ Pure Domain Logic (src/lib/) ]   [ Prisma ORM Transactions ]
(Cycle checks, analytics, filters)           │
                                             ▼
                              [ PostgreSQL 16 + pgvector ]
                                  │ DomainEvent outbox ▲
                                  ▼                    │ HMAC-signed
[ pulse-agent: Python + LangGraph + APScheduler ] ─────┘ Internal API
  (Agent-000 Supervisor → Agents 001–009)           (/api/internal/agent/*)
```

### Architectural Principles
- **Pure Business Logic Isolation:** All algorithmic operations (cycle detection, burndown math, filter compilation, seed generators) reside in pure functions under `src/lib/`.
- **Centralized Authorization:** Every Server Action delegates membership and role verification to `src/lib/authz.ts`.
- **Atomic Concurrency:** Mutations prone to race conditions (e.g. `completeSprint`) use atomic Prisma `updateMany` guards.
- **Non-blocking Side Effects:** Activity logging and notification/email dispatches are isolated in internal error handlers to prevent transactional rollbacks.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | Server Components, Server Actions, SSR |
| **Language** | TypeScript 5 (Strict Mode) | End-to-end type safety |
| **Styling** | Tailwind CSS v4, Lucide React | Modern dark/light responsive interface |
| **State & Drag-and-Drop** | @dnd-kit (core, sortable, utilities) | Accessible, 60fps drag-and-drop interactions |
| **Database & ORM** | PostgreSQL 16 + pgvector, Prisma v6.19 | Relational database, vector search, typed migrations |
| **Agent Service** | Python 3.11+, LangGraph, APScheduler, psycopg 3 | Event-driven and scheduled coordination agents |
| **Authentication** | NextAuth.js v4 + bcryptjs (salt:12) | Credentials-based JWT authentication |
| **Markdown** | react-markdown + remark-gfm | GitHub-flavored markdown parsing and rendering |
| **Email Service** | Nodemailer | Universal SMTP, Ethereal test, and console mailer |
| **Testing** | Vitest v5, Pytest | TypeScript and Python unit/integration tests |

---

## Project Structure

```
Pulse/
├── agent/                       # Python LangGraph agent service (pulse-agent)
│   ├── src/                     # Supervisor, poller, scheduler, Agents 001–009
│   └── tests/                   # 17 Pytest suites (98 tests)
├── prisma/
│   ├── schema.prisma            # 26 Pulse models (+4 LangGraph checkpoint tables) & 9 enums
│   ├── migrations/              # Incremental SQL migration history
│   └── seed-realistic-data.ts   # Deterministic PRNG seeding script
├── src/
│   ├── actions/                 # Server Actions with authz guards
│   ├── app/                     # Next.js App Router pages and API routes
│   ├── components/              # Modular React 19 UI components
│   │   ├── board/               # Kanban board & drag-and-drop columns
│   │   ├── dashboard/           # Analytics cards, activity feeds, metrics
│   │   ├── filters/             # Filter bars, quick chips, saved views
│   │   ├── search/              # Command palette (Ctrl+K)
│   │   ├── settings/            # States, labels, member administration
│   │   ├── sprints/             # Sprint cards, modals, task picker
│   │   └── task-detail/         # Slide-over modal, relations, proposals
│   └── lib/                     # Pure business domain logic
│       ├── authz.ts             # Centralized server authorization
│       ├── mail.ts              # Nodemailer email engine
│       └── __tests__/           # 39 Vitest test suites (740 tests)
└── docs/
    ├── screenshots/             # README screenshots
    ├── wiki/                    # 36 Architecture Decision Records (ADRs)
    ├── spec/                    # Step-by-step implementation specifications
    └── ai-context/              # Modular AI architectural snapshots
```

---

## Setup

### Prerequisites
- **Node.js:** v20 or higher (npm v10+)
- **Docker & Docker Compose:** For PostgreSQL 16 with the `pgvector` extension
- **Python:** v3.11 or higher *(optional — only for the `pulse-agent` coordination service)*

### Quickstart

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/CodeByOktay/Pulse.git
   cd Pulse
   npm install
   ```
   The committed `.npmrc` sets `legacy-peer-deps=true`: `next-auth@4` declares an optional peer on `nodemailer@^7`, while Pulse uses `nodemailer@^10` for its own mail service (the next-auth email provider is not used).
   On npm 11+, the Prisma and `unrs-resolver` install scripts are pre-approved through the `allowScripts` field in `package.json`.

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Replace `NEXTAUTH_SECRET` with a random value (`openssl rand -base64 32`).

3. **Start the PostgreSQL database:**
   ```bash
   docker compose up -d db
   ```
   This starts only the `pgvector/pgvector:pg16` database. A plain `postgres` image will not work: the migrations require the `vector` extension.
   *(Standalone alternative: `docker run --name pulse-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pulse -p 5432:5432 -d pgvector/pgvector:pg16`)*

4. **Apply database migrations:**
   ```bash
   npx prisma migrate dev
   ```

5. **(Optional) Seed rich mock dataset:**
   ```bash
   npm run db:seed-rich
   ```
   *Seeds 10 user personas (password: `password123`), 5 projects, sprints, tasks, comments, and activity history.*

6. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

7. **(Optional) Run the agent service locally:**
   ```bash
   cd agent
   python -m venv .venv
   .venv/Scripts/activate          # Windows (source .venv/bin/activate on Linux/macOS)
   pip install -r requirements.txt
   python -m src.main
   ```
   The agent reads `DATABASE_URL` and `INTERNAL_API_SECRET` from the repository root `.env`. See [`agent/README.md`](agent/README.md) for all settings.

---

## Environment Variables

Configure the following variables in your `.env` file (see [`.env.example`](.env.example) for the complete, commented list):

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/pulse?schema=public` |
| `NEXTAUTH_SECRET` | Secret key for JWT session encryption | Generate via `openssl rand -base64 32` |
| `NEXTAUTH_URL` / `APP_URL` | Canonical application URL | `http://localhost:3000` |
| `INTERNAL_API_SECRET` | Shared HMAC secret between Next.js and `pulse-agent` | Dev-only default; **must be changed in production** |
| `EMAIL_FROM` | Outgoing sender address | `Pulse <noreply@pulse.local>` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP delivery (leave host empty for Ethereal/console fallback) | `smtp.example.com`, `587` |
| `AI_ENDPOINT` / `AI_MODEL` / `AI_API_KEY` | Provider-agnostic (OpenAI-compatible) chat endpoint for AI features | Empty = deterministic heuristic fallback |
| `AI_EMBEDDING_ENDPOINT` / `AI_EMBEDDING_MODEL` | Embeddings endpoint for semantic search (1536-dim vectors) | Empty = text-only search |

Non-secret AI settings can alternatively live in `ai.config.json` (copy from [`ai.config.example.json`](ai.config.example.json)); API keys belong in the environment only.

---

## Database

Pulse uses **PostgreSQL 16** with the **pgvector** extension, managed via **Prisma ORM v6.19**. The schema comprises **26 Pulse models** (plus 4 LangGraph checkpoint tables owned by the agent service) and **9 enums**. The diagram below shows the core domain.

```mermaid
erDiagram
    User ||--o{ Project : "owns"
    User ||--o{ ProjectMember : "belongs to"
    User ||--o{ TaskAssignee : "assigned to"
    User ||--o{ Comment : "writes"
    User ||--o{ Activity : "performs"
    User ||--o{ ProjectInvite : "sends"
    User ||--o{ Notification : "receives"
    User ||--o| UserNotificationPreference : "configures"
    User ||--o{ ProgressRequest : "creates"
    User ||--o{ ProgressResponse : "submits"
    User ||--o{ AgentProposal : "reviews"

    Project ||--o{ ProjectMember : "contains"
    Project ||--o{ State : "defines"
    Project ||--o{ Task : "manages"
    Project ||--o{ Label : "categorizes"
    Project ||--o{ Sprint : "schedules"
    Project ||--o{ ProjectInvite : "invites"

    State ||--o{ Task : "groups"

    Task ||--o{ TaskLabel : "tagged with"
    Task ||--o{ TaskAssignee : "worked on by"
    Task ||--o{ Comment : "discussed in"
    Task ||--o{ SprintTask : "planned in"
    Task ||--o{ Activity : "logged by"
    Task ||--o{ TaskRelation : "source relation"
    Task ||--o{ TaskRelation : "target relation"
    Task ||--o{ ProgressRequest : "tracks"
    Task ||--o{ AgentProposal : "receives"

    ProgressRequest ||--o| ProgressResponse : "fulfills"
    ProgressResponse ||--o| AgentProposal : "interpreted as"
    Sprint ||--o{ SprintTask : "includes"
```

### Key Models & Enums
- **Core Entities:** `User`, `Project`, `ProjectMember`, `State`, `Task`, `Label`, `TaskAssignee`, `TaskLabel`, `Comment`.
- **Sprint Management:** `Sprint`, `SprintTask` (`SprintStatus`: `DRAFT`, `ACTIVE`, `COMPLETED`).
- **Audit & Relations:** `Activity` (24 types, `isAiGenerated`), `TaskRelation` (`BLOCKS`, `RELATES_TO`, `DUPLICATES`).
- **Notifications & Preferences:** `Notification` (12 types), `UserNotificationPreference`, `ProjectInvite`.
- **AI Coordination:** `ProgressRequest`, `ProgressResponse`, `AgentProposal` (`PENDING`, `APPROVED`, `REJECTED`, `STALE`).
- **Agent Infrastructure:** `DomainEvent` (outbox), `AgentRun` (idempotent run log), `AgentSettings`, `SystemClock`, `DailyStandup`, `StandupEntry`.
- **Project Memory:** `TaskEmbedding` (`vector(1536)` with an ivfflat cosine index).

---

## Development Workflow

Pulse employs an **AI-Assisted Pair Programming & Dual-Agent Protocol**:

- **Antigravity (Lead Architect & QA Authority):** Responsible for architectural design, trade-off analysis, ADR authoring (`docs/wiki/`), AI memory curation (`docs/ai-context/`), and exclusive ownership of all test suites (`src/lib/__tests__/`).
- **Claude Code (Builder & Implementer):** Implements features across database, server actions, and UI components. Follows the Golden Rule: *Never modify or weaken test files; fix implementation code until tests pass.*

### Commands
```bash
npm run dev        # Start local Next.js Turbopack dev server
npm test           # Run 740 Vitest unit and integration tests
npx tsc --noEmit   # Validate TypeScript types (zero errors)
npm run build      # Verify production build compilation
cd agent && pytest # Run 98 Pytest tests for the agent service
```

---

## Testing

Pulse adheres to strict quality assurance invariants:
- **Pure Domain Testing:** Server Actions are kept thin; complex algorithms reside in isolated pure functions tested deterministically with zero side effects.
- **Coverage:** **838 tests** — 740 Vitest tests across 39 suites and 98 Pytest tests across 17 suites — maintaining a 100% pass rate.
- **Test Inviolability:** Implementation fixes must never alter test assertions.

```bash
# Run the complete test suite
npm test

# Run tests in watch mode
npx vitest

# Run a specific suite
npx vitest src/lib/__tests__/task-relations.test.ts
```

---

## RBAC Model

Pulse enforces granular Role-Based Access Control scoped per project:

| Capability | OWNER | ADMIN | MEMBER |
|---|:---:|:---:|:---:|
| View Board, List & Backlog | ✅ | ✅ | ✅ |
| Create, Edit & Move Tasks | ✅ | ✅ | ✅ |
| Add Comments & Relations | ✅ | ✅ | ✅ |
| Manage Personal Notification Preferences | ✅ | ✅ | ✅ |
| Manage Sprints (Create, Start, Complete) | ✅ | ✅ | ❌ |
| Manage Project States & Labels | ✅ | ✅ | ❌ |
| Invite & Remove Members | ✅ | ✅ | ❌ |
| Change Member Roles | ✅ | ✅ | ❌ |
| Delete Project / Transfer Ownership | ✅ | ❌ | ❌ |

All mutations execute through centralized server guards: `requireSession`, `requireMembership`, `requireAdmin`, and `assertNotProjectOwner`.

---

## API Documentation

Pulse utilizes Next.js **Server Actions** (`"use server"`) as its primary mutation interface, complemented by NextAuth route handlers:

### Server Actions Overview
- **`src/actions/task.ts`:** Task CRUD, float position calculation, cross-project ID verification, state assignment.
- **`src/actions/sprint.ts`:** Sprint lifecycle transitions, atomic completion guard, task sprint assignment.
- **`src/actions/member.ts`:** Member invitations (7-day tokens), role management, member offboarding.
- **`src/actions/relation.ts`:** Dependency creation with iterative DFS cycle checks and perspective inversion.
- **`src/actions/notification.ts`:** In-app notification retrieval, batch read updates, approaching due date checks.
- **`src/actions/progress.ts`:** Progress request issuance and team member response submission.
- **`src/actions/agent-proposal.ts`:** AI proposal generation, human approval, and rejection handlers.
- **`src/actions/search.ts`:** Scoped global search across tasks and project titles.
- **`src/actions/semantic-search.ts`:** Hybrid vector/text search over project memory.
- **`src/actions/agent-settings.ts`, `standup.ts`, `clock.ts`:** Per-project agent configuration, standup submission, and development-only time simulation.

### HTTP Endpoints
- `GET/POST /api/auth/[...nextauth]` — NextAuth.js session and authentication endpoints.
- `POST /api/auth/register` — New user account registration with automated welcome email dispatch.
- `POST /api/internal/agent/*` — 17 HMAC-SHA256 signed endpoints used exclusively by the `pulse-agent` service (not user-facing).

---

## Deployment

Pulse is containerized for standard Docker environments and production cloud providers (Vercel, Railway, AWS ECS).

### Production Docker Build
The compose stack runs three services: `db` (PostgreSQL + pgvector), `app` (Next.js production build), and `agent` (Python coordination service).
```bash
# 1. Environment for the app container
cp .env.docker.example .env.docker   # then replace every placeholder

# 2. The agent and database read POSTGRES_PASSWORD / INTERNAL_API_SECRET from the root .env;
#    INTERNAL_API_SECRET must match the value in .env.docker

# 3. Build and run
docker compose up --build -d
```

### Standalone Production Build
```bash
npm run build
npm run start
```

### Production Checklist
- [ ] Configure strong, random `NEXTAUTH_SECRET`.
- [ ] Set a unique `INTERNAL_API_SECRET` for both the app and the agent — production builds reject every agent request while the public default is in use.
- [ ] Change `POSTGRES_PASSWORD` (and the matching `DATABASE_URL`) from the development default `password`.
- [ ] Set canonical `NEXTAUTH_URL` / `APP_URL` matching your production domain.
- [ ] Configure active SMTP credentials for transactional emails.
- [ ] Run `npx prisma migrate deploy` on the production database.
- [ ] Keep `ENABLE_TIME_TRAVEL` unset (time simulation is disabled in production by default).

---

## Roadmap

- [x] **Phase 1 (v0.1.0):** Core Kanban, Auth, Task CRUD, Slide-over panel, Float ordering.
- [x] **Phase 2 (v0.2.0):** Sprints/Cycles, Tabular List View, Audit Log, Bulk Actions, Markdown Editor, Project Settings.
- [x] **Phase 3 (v0.3.0):** Member Invites, Task Detail UX, Backlog View, Global Search (Ctrl+K), Analytics Dashboard, Advanced Filters, Task Relations (Dependency Graph & Cycle Prevention).
- [x] **Phase 4 (v0.4.0):** In-App Notifications with Polling, User Notification Preferences, `@mention` detection, Due Date Alerts, Universal Nodemailer Service, Rich PRNG Analytics Dataset.
- [x] **Phase 5 MVP & Hardening (v0.5.4):**
  - Domain Event Foundation & `TASK_UNBLOCKED` dependency automation.
  - Interactive `ProgressRequest` and `ProgressResponse` lifecycle.
  - AI Progress Interpretation engine and human-in-the-loop `AgentProposal` approval UI.
  - 4-Wave Full-Stack Refactoring & 3 Targeted Hardening Packages (Authz consolidation, Modal UX, Concurrency guards).
- [x] **Phase 6 (v0.6.0 – v0.6.7): AI Agent Coordination System**
  - Python LangGraph service, `DomainEvent` outbox, APScheduler, HMAC Internal API, testable clock (Agent-000 Supervisor).
  - Agent-001 Deadline Tracker, Agent-002 Task Hygiene, Agent-003 Status Requester (interrupt/resume).
  - Agent-004 Blocker Manager, Agent-009 Scope Creep Detection.
  - Agent-005 Async Standup, Agent-006 Weekly Sprint Digest.
  - Agent-007 Workload Balancer, Agent-008 Sprint Assistant.
  - Project Memory & RAG semantic search (pgvector), Slot Replay & time-travel security, multi-agent consolidation.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create a descriptive feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Adhere to Code Standards:**
   - Keep business logic in pure, testable functions under `src/lib/`.
   - Never weaken or alter existing test suites in `src/lib/__tests__/`.
   - Ensure all checks pass before submitting:
     ```bash
     npm test
     npx tsc --noEmit
     npm run build
     ```
3. **Submit a Pull Request** with a detailed summary of changes and rationale.

---

## License

This project is licensed under the [MIT License](LICENSE).
