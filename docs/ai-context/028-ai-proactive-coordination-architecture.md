# Pulse — AI Proactive Coordination Architecture (ADR-028)

## Overview
Pulse is adopting a three-tier proactive AI project coordination system: Deterministic Domain Automation (no LLM), AI-Assisted Coordination (LLM for NL interpretation), and Human-Controlled Decisions (approval-gated mutations). The system tracks task dependencies, sends automated notifications when blockers clear, collects progress updates from team members, interprets natural language responses via structured AI output, and applies Kanban/Sprint changes only after human approval.

- **Milestone:** Phase 5, Step 5.01 (`v0.5.0` — Faz 0: Architecture Decisions)
- **ADR Reference:** `ADR-028-AI Destekli Proaktif Proje Koordinasyon Mimarisi`
- **MVP Scope:** Faz 0-4 (Deterministic automation + AI progress interpretation + approval-gated updates)
- **Total Planned Tests:** 416 (existing) + ~70 new (Faz 1-4) ≈ 486 tests

---

## Key Architectural Decisions

### 1. Three-Tier Automation Separation
- **Tier A (Deterministic):** Task completion → dependency graph check → TASK_UNBLOCKED notification. No LLM, no LangGraph. Domain service + notification system.
- **Tier B (AI-Assisted):** Natural language progress response → structured interpretation → update proposal. LLM required, but single-turn (no LangGraph until Faz 5).
- **Tier C (Human Decision):** Task status → DONE, sprint scope changes, assignee changes, bulk mutations. Always requires explicit user approval.

### 2. Technology Introduction Timeline
| Technology | Phase | Rationale |
|---|---|---|
| LLM API (OpenAI/Anthropic) | Faz 4 | First AI use: progress response interpretation |
| LangGraph.js | Faz 5 | Multi-turn stateful coordination (interrupt + resume) |
| LlamaIndex.TS | Faz 7 | RAG: project context search (when needed) |
| pgvector | Faz 7 | Vector search (with LlamaIndex) |

### 3. Domain Event Strategy
- Synchronous post-transaction hook (not outbox pattern).
- `updateTask()` → state changes to DONE group → `onTaskCompleted(taskId, projectId)` triggers dependency check.
- Can evolve to outbox pattern in Faz 5-6 if throughput demands it.

### 4. AI Execution Identity
- Bot User (`pulse-ai-bot`): Fixed `actorId`, cannot login (empty hash), authorized per-project via ProjectMember.
- `isAiGenerated` flag on Activity: UI badge (🤖) differentiation.
- Effective permission = requesting user's permissions ∩ agent tool allowlist.

### 5. Autonomy Levels (MVP)
- **Level 1 (Notify):** TASK_UNBLOCKED, PROGRESS_REQUESTED — automatic, no data mutation.
- **Level 2 (Propose):** AI progress interpretation → status change proposal — requires user approval.
- **Human Required:** DONE status, sprint lifecycle, assignee/due date changes, destructive operations.

---

## New Models (Planned across Faz 1-4)
- **Faz 1:** `NotificationType` enum expansion (+TASK_UNBLOCKED, +PROGRESS_REQUESTED), `ActivityType` enum expansion (+6 values), `Activity.isAiGenerated` Boolean field.
- **Faz 3:** `ProgressRequest` model, `ProgressResponse` model.
- **Faz 4:** `AgentProposal` model.

## New Domain Logic Files (Planned)
- `src/lib/automation-logic.ts` — Deterministic: `isCompletionTransition`, `findNewlyUnblockedTasks`, idempotency.
- `src/lib/progress-logic.ts` — ProgressRequest/Response validation.
- `src/lib/ai/interpreter.ts` — LLM call + Zod structured output validation.
- `src/lib/ai/config.ts` — `AI_ENABLED` flag, model selection, bot user constants.
- `src/actions/progress.ts` — ProgressRequest/Response server actions.
- `src/actions/agent-proposal.ts` — AgentProposal CRUD + approval flow.

## Reference Use Case
Özlem's "Debug" task BLOCKS Uygar's "Dashboard" task. When Özlem marks Debug as DONE → system checks all blockers → Dashboard has no remaining active blockers → Uygar receives automatic TASK_UNBLOCKED notification → (Faz 3+) system requests progress → (Faz 4+) AI interprets response → user approves → Kanban updates.
