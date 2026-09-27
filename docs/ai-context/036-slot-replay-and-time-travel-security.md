# Pulse — Slot Replay & Time Simulation Security (ADR-036)

## Overview
Step 6.08 consolidates the multi-agent coordination system and closes the divergence between the wall-clock scheduler (APScheduler) and virtual time travel (`SystemClock.mockTime`). When time is fast-forwarded (e.g., +7 days in testing), skipped cron slots are reconstructed and chronologically executed in a sandboxed, task-local time context (`asOf`). Time travel mutations and agent executions are gated by session authentication and production environment flags.

- **Milestone:** Phase 6, Step 6.08 (`v0.6.7` — Final Hardening & Multi-Agent Coordination Verification)
- **ADR Reference:** [`ADR-036-slot-replay-ve-zaman-simulasyonu-guvenligi.md`](../wiki/ADR-036-slot-replay-ve-zaman-simulasyonu-guvenligi.md)
- **Status:** Implemented & Verified

---

## Key Invariants & Mechanisms

### 1. Slot Replay Engine (`agent/src/replay.py`)
- **Trigger:** Emitted by Next.js as a `CLOCK_ADVANCED` DomainEvent with `{ "previous": ISO, "current": ISO, "actorId": ... }`.
- **Planning (`plan_missed_slots`):** Pure function calculating missed slots in the half-open interval `(previous, current]`.
  - Daily 09:00: `DAILY` supervisor sweep (Agents 001, 002, 003).
  - Daily 09:30: `STANDUP_OPEN` phase (Agent-005).
  - Daily 11:30: `STANDUP_CUTOFF` synthesis (Agent-005).
  - Friday 17:00: `WEEKLY_DIGEST` publication (Agent-006).
  - Ordered chronologically; same-instant tie-breaking follows declaration order.
  - Capped to trailing 14 days (`max_days=14`) to prevent unbounded queue saturation.
  - Backward jumps (`current <= previous`) yield an empty list (safe no-op).
- **Execution (`execute_replay`):**
  - Uses `now_override(slot.fire_at)` ContextVar to pin `get_now()` for the active asyncio task.
  - Replayed runs pass `scheduledFor = slot.fire_at`, utilizing the existing `AgentRun @@unique(["agentKey", "projectId", "scheduledFor"])` constraint to guarantee idempotency.
  - Replay results are stamped with `result.replayed = true` in `AgentRun`.

### 2. Time-Aware Internal API & AsOf Propagation
- **InternalClient (`agent/src/internal_client.py`):** Automatically injects `"asOf": override.isoformat()` into request JSON bodies whenever `now_override` is active.
- **Request Resolution (`src/lib/internal-agent-request.ts`):** `resolveAgentNow(body)` returns the parsed `asOf` date if valid ISO string, or falls back to system `getNow()`. Invalid ISO strings return null and trigger HTTP 400.
- **Read Authentication:** `GET /api/internal/agent/clock` requires HMAC signature (`verifyInternalSignature`), locking unauthorized clock inspection.

### 3. Time Travel Security & Gating (`src/lib/clock-service.ts`)
- **Production Safety:** `isTimeTravelEnabled(env)` permits virtual clock modification only when `NODE_ENV !== "production"` or `ENABLE_TIME_TRAVEL === "true"`.
- **Authentication:** `setAppClockAction` and `resetAppClockAction` strictly enforce `requireSession()`.
- **Manual Trigger Scope:** `triggerAgentRunsAction` requires user session and verifies active project membership.

### 4. Unblock Deduplication & Concurrency Guard (`src/lib/unblock-dedup.ts`)
- **Race Condition Prevention:** Resolves potential double notification between synchronous task state completion (`triggerUnblockedDependencies`) and Agent-004's safety net poller (`checkUnblockedDependencies`).
- **Advisory Locking:** Employs PostgreSQL transactional advisory lock (`pg_advisory_xact_lock(hashtext('unblock-announce:' || taskId))`).
- **Timestamp Evaluation (`computeLastBlockedAt`):** Pure domain logic in `src/lib/blocker-logic.ts` evaluating relation creation timestamps and blocker `TASK_STATE_CHANGED` activity logs to prevent stale re-announcements while allowing genuine reopen/re-block cycles.

### 5. Poller Timeout & Resilience (`agent/src/poller.py`)
- **Handler Timeout:** Wrapped in `asyncio.wait_for(..., timeout=get_effective_handler_timeout(timeout, lease))`, enforcing a hard ceiling well below the lease duration (default 120s with 600s lease).
- **Graceful Shutdown:** Unstarted events are released back to `PENDING` (`release_events`) so no orphaned `PROCESSING` locks persist upon container restart.
- **Liveness Heartbeat (`agent/src/health.py`):** Poller loop updates a local heartbeat file (`DEFAULT_HEARTBEAT_FILE`) evaluated against real wall-clock time (`is_heartbeat_fresh`), decoupled from simulated application time.
