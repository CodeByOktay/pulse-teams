# Pulse — AI Agent Coordination Infrastructure (ADR-034)

## Overview
Phase 6 introduces a proactive AI agent coordination system with a Python LangGraph container alongside the existing Next.js application. Ten specialized agents (Agent-000 through Agent-009) progressively automate project management tasks — from deadline tracking and task hygiene to async standups and sprint assistance. The first four agents (000–003) use zero LLM tokens; all operate through a DomainEvent outbox pattern and HMAC-protected Internal API.

- **Milestone:** Phase 6, Step 6.02 (`v0.6.1` — Agent-001 & Activity Widget completed)
- **ADR Reference:** `ADR-034-AI Agent Koordinasyon Altyapisi ve Proaktif Agent Sistemi`
- **Phase 6 Scope:** Steps 6.00–6.03 (Infrastructure + Agent-001/002/003)
- **Current Tests:** 587 passing (553 Vitest + 34 Pytest, 100% passing)

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

### 4. Agent Catalog (10 Agents)
| Agent | Purpose | LLM | Tier | Phase |
|---|---|---|---|---|
| Agent-000 | Supervisor: routing, rate-limiting, logging | No | — | 6 |
| Agent-001 | Deadline Tracker: approaching/overdue reminders + ADMIN escalation | No | A | 6 |
| Agent-002 | Task Hygiene: missing assignee/deadline/description detection | No | A | 6 |
| Agent-003 | Status Requester: stale task inquiry with interrupt/resume buttons | No | A | 6 |
| Agent-004 | Blocker Manager: dependency chain tracking + escalation | No | A | 7 |
| Agent-005 | Async Standup: morning form + LLM summary | Yes | B | 7 |
| Agent-006 | Weekly Report: sprint health + team summary | Yes | B | 7 |
| Agent-007 | Workload Balancer: overloaded/idle detection + reassignment proposals | Yes | B | 8 |
| Agent-008 | Sprint Assistant: overflow warning + retro draft | Yes | B | 8 |
| Agent-009 | Scope Creep Detection: mid-sprint scope growth detection | No | A | 7 |

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

| Model | Purpose | Relations |
|---|---|---|
| `DomainEvent` | Outbox table: event type, JSON payload, processing status | — |
| `AgentRun` | Agent execution history: agent key, project, status, result, token count | → Project |
| `AgentSettings` | Per-project per-agent toggle + config + PM user selection | → Project, → User |

**Model count:** 19 → 22. **Enum count:** 9 (unchanged in Step 6.00).

## New Files (Planned)

### TypeScript (Next.js)
- `src/lib/clock.ts` — Testable clock abstraction.
- `src/lib/domain-events.ts` — `emitDomainEvent(tx, type, payload)` writer.
- `src/app/api/internal/agent/` — HMAC-protected internal endpoints.

### Python (Agent Container)
- `agent/src/supervisor.py` — Agent-000: DomainEvent poller + APScheduler + catch-up.
- `agent/src/agents/agent_001.py` — Deadline Tracker graph.
- `agent/src/agents/agent_002.py` — Task Hygiene graph.
- `agent/src/agents/agent_003.py` — Status Requester graph (interrupt/resume).
- `agent/src/poller.py` — DomainEvent SKIP LOCKED poller.
- `agent/src/scheduler.py` — APScheduler configuration.
- `agent/src/catchup.py` — Startup catch-up logic.
- `agent/src/internal_client.py` — Next.js Internal API client (HMAC).
- `agent/src/clock.py` — Python clock abstraction.

## Step Roadmap
| Step | Version | Content |
|---|---|---|
| 6.00 | v0.6.0-pre | ADR-034 (this document) |
| 6.01 | v0.6.0 | Infrastructure: Schema, DomainEvent, Clock, Python container, Supervisor, Internal API, AgentSettings UI |
| 6.02 | v0.6.1 | Agent-001 (Deadline Tracker) + "Agent Activity" dashboard widget |
| 6.03 | v0.6.2 | Agent-002 (Task Hygiene) + Agent-003 (Status Requester with interrupt/resume) |
