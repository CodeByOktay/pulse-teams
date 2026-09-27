# Pulse — AI Context & Architecture Index

> **Single Source of Truth:** Central system architecture, active domain models, critical technical invariants, test distributions, and completed phases are maintained exclusively in [`context.md`](../../CONTEXT.md) at the project root.

---

## Incremental Architectural Snapshots (`docs/ai-context/`)
The files in this directory contain deep, ADR-linked architectural memory snapshots recorded at each milestone:

- [`024-seed-dataset-architecture.md`](./024-seed-dataset-architecture.md) (ADR-024) — Seed personas, project scopes, state mappings, and dataset architecture.
- [`025-in-app-notifications.md`](./025-in-app-notifications.md) (ADR-025) — In-app notification polling and trigger hooks.
- [`026-notification-preferences-and-mentions.md`](./026-notification-preferences-and-mentions.md) (ADR-026) — Notification preferences, mention parsing, and due date alerts.
- [`027-email-service-and-welcome-email.md`](./027-email-service-and-welcome-email.md) (ADR-027) — Resilient email dispatch engine and welcome email templates.
- [`028-ai-proactive-coordination-architecture.md`](./028-ai-proactive-coordination-architecture.md) (ADR-028) — Three-tier AI coordination, domain event foundation, and dependency automation.
- [`029-domain-event-foundation.md`](./029-domain-event-foundation.md) (ADR-029) — Domain event foundation, enum expansions, and pure automation logic.
- [`030-dependency-automation.md`](./030-dependency-automation.md) (ADR-030) — Task dependency unblocking automation and in-app notifications.
- [`031-progress-request-response-lifecycle.md`](./031-progress-request-response-lifecycle.md) (ADR-031) — Interactive progress collection lifecycle and response validation.
- [`032-ai-progress-interpretation-and-proposals.md`](./032-ai-progress-interpretation-and-proposals.md) (ADR-032) — AI progress interpretation, AgentProposal, and human approval flow.
- [`033-codebase-refactoring-and-architecture-hardening.md`](./033-codebase-refactoring-and-architecture-hardening.md) (ADR-033) — 4-wave refactoring, 3 targeted hardening packages (authz, modal UX, concurrency), React 19 / ESLint hydration fixes, and project analytics test suite.
- [`034-ai-agent-coordination-infrastructure.md`](./034-ai-agent-coordination-infrastructure.md) (ADR-034) — Python LangGraph container, DomainEvent outbox, APScheduler, 10-agent catalog (Agent-000 through Agent-009), HMAC-protected Internal API, Clock abstraction, and catch-up on startup.
- [`035-project-memory-and-rag-semantic-search.md`](./035-project-memory-and-rag-semantic-search.md) (ADR-035) — Project Memory, PostgreSQL pgvector integration, TaskEmbedding model, ivfflat indexing, SHA-256 content hashing, hybrid search ranking, and Similar Tasks UI.
- [`036-slot-replay-and-time-travel-security.md`](./036-slot-replay-and-time-travel-security.md) (ADR-036) — Slot Replay engine, time travel security gating, unblock deduplication with advisory lock, and poller resilience.

