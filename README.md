# Pulse

> Modern, high-performance Kanban & Sprint management platform with proactive AI project coordination.

[![Version](https://img.shields.io/badge/version-v0.5.4-blue.svg)](https://github.com/CodeByOktay/Staj-Projesi)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Vitest-528%20passed-success?logo=vitest)](https://vitest.dev/)

---

## Overview

Pulse is a developer-centric, full-featured project management platform designed for agile software teams. Built with Next.js 16 and PostgreSQL, it delivers sub-millisecond local interactions, fluid drag-and-drop workflows, and deterministic business logic.

Beyond traditional project tracking, Pulse introduces **Proactive AI Coordination**: an approval-gated, three-tier automation system that detects resolved task dependencies, collects progress reports from team members, interprets natural language status updates, and proposes Kanban/Sprint mutations under human control.

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
- **Project Settings & RBAC:** Admin-governed state pipelines, custom color-coded labels, and role-based project member access control.

---

## Screenshots

| Kanban Board | Task Detail & Slide-Over |
| :---: | :---: |
| *(Interactive columns, quick task creation, filter chips)* | *(Markdown editor, status/priority popovers, relation graph)* |

| Sprint Management | Command Palette (Ctrl+K) |
| :---: | :---: |
| *(Draft/Active/Completed states, burn metrics, scope controls)* | *(Fast fuzzy search, project navigation, keyboard shortcuts)* |

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
                                    [ PostgreSQL 16 DB ]
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
| **Database & ORM** | PostgreSQL 16, Prisma v6.19 | Relational database, typed migrations and schema |
| **Authentication** | NextAuth.js v4 + bcryptjs (salt:12) | Credentials-based JWT authentication |
| **Markdown** | react-markdown + remark-gfm | GitHub-flavored markdown parsing and rendering |
| **Email Service** | Nodemailer | Universal SMTP, Ethereal test, and console mailer |
| **Testing** | Vitest v5 | Fast unit and integration test execution |

---

## Project Structure

```
Pulse/
├── prisma/
│   ├── schema.prisma            # 19 Database models & 9 enums
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
│       └── __tests__/           # 27 Vitest test suites (528 tests)
└── docs/
    ├── wiki/                    # 33 Architecture Decision Records (ADRs)
    └── ai-context/              # Modular AI architectural snapshots
```

---

## Setup

### Prerequisites
- **Node.js:** v20.0.0 or higher
- **npm:** v10.0.0 or higher
- **Docker & Docker Compose:** For running PostgreSQL 16

### Quickstart

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/CodeByOktay/Staj-Projesi.git
   cd Staj-Projesi
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start PostgreSQL database:**
   ```bash
   docker compose up -d
   ```
   *(Or run standalone: `docker run --name pulse-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pulse -p 5432:5432 -d postgres:16`)*

4. **Apply database migrations:**
   ```bash
   npx prisma migrate dev
   ```

5. **(Optional) Seed rich mock dataset:**
   ```bash
   npm run db:seed-rich
   ```
   *Seeds 10 user personas (password: `password123`), 5 projects, 500 tasks, 1,000 comments, and 3,000 activities.*

6. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Configure the following variables in your `.env` file:

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/pulse?schema=public` |
| `NEXTAUTH_SECRET` | Secret key for JWT session encryption | Generate via `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical application URL | `http://localhost:3000` |
| `EMAIL_FROM` | Outgoing sender address | `"Pulse" <notifications@pulse.local>` |
| `SMTP_HOST` | SMTP server host (leave empty for test) | `smtp.example.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `user@example.com` |
| `SMTP_PASS` | SMTP password | `secret_password` |
| `AI_ENABLED` | Toggle AI features (interpreter & bot) | `true` |
| `AI_PROVIDER` | AI backend provider (`mock`, `gemini`, `openai`) | `mock` |
| `GEMINI_API_KEY` | Google Gemini API key (optional) | `AIzaSy...` |

---

## Database

Pulse uses **PostgreSQL 16** managed via **Prisma ORM v6.19**. The schema comprises **19 models** and **9 enums**.

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
- **Audit & Relations:** `Activity` (23 types, `isAiGenerated`), `TaskRelation` (`BLOCKS`, `RELATES_TO`, `DUPLICATES`).
- **Notifications & Preferences:** `Notification` (7 types), `UserNotificationPreference`, `ProjectInvite`.
- **AI Coordination:** `ProgressRequest`, `ProgressResponse`, `AgentProposal` (`PENDING`, `APPROVED`, `REJECTED`, `STALE`).

---

## Development Workflow

Pulse employs an **AI-Assisted Pair Programming & Dual-Agent Protocol**:

- **Antigravity (Lead Architect & QA Authority):** Responsible for architectural design, trade-off analysis, ADR authoring (`docs/wiki/`), AI memory curation (`docs/ai-context/`), and exclusive ownership of all test suites (`src/lib/__tests__/`).
- **Claude Code (Builder & Implementer):** Implements features across database, server actions, and UI components. Follows the Golden Rule: *Never modify or weaken test files; fix implementation code until tests pass.*

### Commands
```bash
npm run dev        # Start local Next.js Turbopack dev server
npm test           # Run 528 Vitest unit and integration tests
npx tsc --noEmit   # Validate TypeScript types (zero errors)
npm run build      # Verify production build compilation
```

---

## Testing

Pulse adheres to strict quality assurance invariants:
- **Pure Domain Testing:** Server Actions are kept thin; complex algorithms reside in isolated pure functions tested deterministically with zero side effects.
- **Coverage:** **528 tests** across **27 test suites**, maintaining a 100% pass rate.
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

### HTTP Endpoints
- `GET/POST /api/auth/[...nextauth]` — NextAuth.js session and authentication endpoints.
- `POST /api/auth/register` — New user account registration with automated welcome email dispatch.

---

## Deployment

Pulse is containerized for standard Docker environments and production cloud providers (Vercel, Railway, AWS ECS).

### Production Docker Build
```bash
# Build and run using Docker Compose
docker compose -f docker-compose.yml up --build -d
```

### Standalone Production Build
```bash
npm run build
npm run start
```

### Production Checklist
- [x] Configure strong, random `NEXTAUTH_SECRET`.
- [x] Set canonical `NEXTAUTH_URL` matching your production domain.
- [x] Configure active SMTP credentials for transactional emails.
- [x] Run `npx prisma migrate deploy` on production database.

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
- [ ] **Phase 5.05:** Multi-turn stateful AI coordination and follow-up loops via LangGraph.js.
- [ ] **Phase 5.06:** Automated proactive follow-up scheduler for stale and approaching tasks.
- [ ] **Phase 6:** Sprint Risk Agent with velocity forecasting and burndown anomaly detection.

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
