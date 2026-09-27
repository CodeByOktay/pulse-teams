# Pulse — AI Agent Coordination Infrastructure (ADR-034)

## Overview
Phase 6 introduces a proactive AI agent coordination system with a Python LangGraph container alongside the existing Next.js application. Ten specialized agents (Agent-000 through Agent-009) progressively automate project management tasks — from deadline tracking and task hygiene to async standups and sprint assistance. The first four agents (000–003) use zero LLM tokens; all operate through a DomainEvent outbox pattern and HMAC-protected Internal API.

- **Milestone:** Phase 6, Step 6.03 (`v0.6.2` — Agent-002 & Agent-003 completed)
- **ADR Reference:** `ADR-034-AI Agent Koordinasyon Altyapisi ve Proaktif Agent Sistemi`
- **Phase 6 Scope:** Steps 6.00–6.08 (Complete 10-Agent Proactive System: Infrastructure + Agents 000–009 + RAG Semantic Search + Hardening)
- **Current Tests:** 653 passing (605 Vitest + 48 Pytest, 100% passing)

---

## Key Architectural Decisions

### 1. Python LangGraph Container
- Separate Docker container (`pulse-agent`) running Python with LangGraph, APScheduler, and PostgreSQL checkpointer.
- Docker Compose: `pulse-db` + `pulse-app` + `pulse-agent`.
- Python has a restricted PostgreSQL role: write access only to DomainEvent status, AgentRun, and AgentProposal.
- LLM provider: Bulutistan (OpenAI-compatible endpoint).

### 2. Communication Protocol
- **Next.js → Python:** DomainEvent outbox table in PostgreSQL. Next.js writes events inside action transactions; Python reads with `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Python → Next.js:** Internal API endpoints (`/api/internal/agent/*`) protected by HMAC shared secret on Docker network. Notifications and ProgressRequests flow through existing TS business logic (authz + logActivity preserved).
- **Critical rule:** Python never mutates task/sprint/user data directly. All mutations go through Next.js Server Actions after human approval.

### 3. Scheduler Strategy (APScheduler)
- Daily agents (001, 002, 003, 005): 09:00 TZ=Europe/Istanbul.
- Weekly agents (006, 007): Friday 17:00.
- Event-based agents (004, 009): Triggered by DomainEvent outbox.
- Catch-up on startup: Checks `AgentRun` table for missed `scheduledFor` times; runs catch-up once per missed slot.

### 4. Agent Catalog (10 Agents — All Phase 6)
| Agent | Purpose | LLM | Tier | Phase |
|---|---|---|---|---|
| Agent-000 | Supervisor: routing, rate-limiting, logging | No | — | 6 |
| Agent-001 | Deadline Tracker: approaching/overdue reminders + ADMIN escalation | No | A | 6 |
| Agent-002 | Task Hygiene: missing assignee/deadline/description detection | No | A | 6 |
| Agent-003 | Status Requester: stale task inquiry with interrupt/resume buttons | No | A | 6 |
| Agent-004 | Blocker Manager: dependency chain tracking + escalation | No | A | 6 |
| Agent-005 | Async Standup: morning form + LLM summary | Yes | B | 6 |
| Agent-006 | Weekly Report: sprint health + team summary | Yes | B | 6 |
| Agent-007 | Workload Balancer: overloaded/idle detection + reassignment proposals | Yes | B | 6 |
| Agent-008 | Sprint Assistant: overflow warning + retro draft | Yes | B | 6 |
| Agent-009 | Scope Creep Detection: mid-sprint scope growth detection | No | A | 6 |

### 5. Agent Identity & Escalation
- Message format: `"[PM name] adına Pulse Asistan"` — acts as the PM's assistant.
- PM user configurable per project via `AgentSettings.pmUserId` (defaults to project owner).
- Escalation target: All members with `ProjectMember.role === 'ADMIN'`.

### 6. Clock Abstraction
- `getNow(): Date` in both TypeScript (`src/lib/clock.ts`) and Python (`agent/src/clock.py`).
- Overridable in tests for time-dependent rules ("3 days stale").
- Both containers set `TZ=Europe/Istanbul` for timezone alignment.

---

## New Database Models (Phase 6)

| Model | Purpose | Relations | Status |
|---|---|---|---|
| `DomainEvent` | Outbox table: event type, JSON payload, processing status | — | Implemented (v0.6.0) |
| `AgentRun` | Agent execution history: agent key, project, status, result, token count | → Project | Implemented (v0.6.0) |
| `AgentSettings` | Per-project per-agent toggle + config + PM user selection | → Project, → User | Implemented (v0.6.0) |
| `SystemClock` | Global virtual clock for testable time simulation and agent sync | — | Implemented (v0.6.2) |
| `DailyStandup` | Team daily standup container (date, LLM summary, blockers) | → Project, → StandupEntry | Planned (v0.6.4) |
| `StandupEntry` | Individual member daily response (yesterday, today, blockers) | → DailyStandup, → User | Planned (v0.6.4) |
| `TaskEmbedding` | Vector embedding storage for RAG semantic similarity search | → Task | Planned (v0.6.6) |

**Model count:** 19 → 23 (current, with `SystemClock`). **Enum count:** 9 (unchanged).

## Key Implementation Files (Phase 6)

### TypeScript (Next.js)
- `src/lib/clock.ts` — Testable clock abstraction with DB sync.
- `src/components/layout/clock-control.tsx` — Interactive virtual time travel UI popover.
- `src/lib/domain-events.ts` — `emitDomainEvent(tx, type, payload)` outbox writer.
- `src/lib/internal-auth.ts` — HMAC-SHA256 request verification for Internal API.
- `src/app/api/internal/agent/` — HMAC-protected internal endpoints (runs, settings, notifications, progress, clock).

### Python (Agent Container)
- `agent/src/supervisor.py` — Agent-000: DomainEvent poller + APScheduler + catch-up + registry.
- `agent/src/agents/agent_001.py` — Deadline Tracker graph.
- `agent/src/agents/agent_002.py` — Task Hygiene graph.
- `agent/src/agents/agent_003.py` — Status Requester graph (LangGraph interrupt/resume).
- `agent/src/poller.py` — DomainEvent SKIP LOCKED poller with lease fencing.
- `agent/src/scheduler.py` — APScheduler configuration (daily 09:00 Europe/Istanbul).
- `agent/src/catchup.py` — Startup catch-up logic for missed slots.
- `agent/src/internal_client.py` — Next.js Internal API client (HMAC signed).
- `agent/src/clock.py` — Python testable clock with DB synchronization.

## Step Roadmap (Phase 6)
| Step | Version | Content | Status |
|---|---|---|---|
| 6.00 | v0.6.0-pre | ADR-034: AI Agent Coordination Architecture | Completed |
| 6.01 | v0.6.0 | Infrastructure: Schema, DomainEvent, Clock, Python container, Supervisor, Internal API, AgentSettings UI | Completed (574 tests) |
| 6.02 | v0.6.1 | Agent-001 (Deadline Tracker) + "Agent Activity" dashboard widget | Completed (587 tests) |
| 6.03 | v0.6.2 | Agent-002 (Task Hygiene) + Agent-003 (Status Requester with interrupt/resume) | Completed (653 tests) |
| 6.04 | v0.6.3 | Agent-004 (Blocker Manager) + Agent-009 (Scope Creep Detection) — Event-driven guardians | Completed (677 tests) |
| 6.05 | v0.6.4 | Agent-005 (Async Standup) + Agent-006 (Weekly Sprint Digest) — LLM-assisted communication & digest | Completed (740 tests) |
| 6.06 | v0.6.5 | Agent-007 (Workload Balancer) + Agent-008 (Sprint Assistant) — LLM-assisted optimization & AgentProposal | Completed (752 tests) |
| 6.07 | v0.6.6 | Project Memory, RAG & Semantic Search (pgvector integration) | Completed (807 tests) |
| 6.08 | v0.6.7 | Phase 6 Multi-Agent Coordination Consolidation, Hardening & Final Verification | Completed (832 tests) |
