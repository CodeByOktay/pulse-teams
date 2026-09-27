"""Agent-009 — Scope Creep Detection (Step 6.04, ADR-034).

Event-driven + scheduled, zero LLM tokens. The scheduled daily 09:00 sweep (via
the Agent-000 supervisor) and the event-driven handlers below both call the same
Next.js Internal API endpoint (`POST /api/internal/agent/scope-creep-check`),
which owns all rule logic (baseline vs. injected task counting, growth-rate
threshold, same-day dedup) in `dispatchScopeCreepCheck` (src/lib/scope-creep-service.ts).

Triggers (spec 6.04 §3.1):
  * Scheduled: `run_for_project` — same shape as Agent-001/002, goes through the
    supervisor's AgentRun claim/rate-limit.
  * Event-driven: `handle_event`, registered for `TASK_SPRINT_ADDED` and
    `TASK_CREATED` in `agents/__init__.py`. Mirrors Agent-003's quick-response
    handler: a lightweight fire-and-forget outside the supervisor's AgentRun
    bookkeeping (reserved for the scheduled slot); the active-sprint check and
    idempotency are enforced server-side by `dispatchScopeCreepCheck` -- most
    `TASK_CREATED` events touch no active sprint at all and resolve to a no-op.
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.clock import get_now
from src.internal_client import InternalClient

logger = logging.getLogger("agent.009")

AGENT_KEY = "agent-009"


class ScopeCreepCheckFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the supervisor records FAILED."""


class ScopeCreepAgent:
    def __init__(self, internal_client: InternalClient):
        self.client = internal_client

    async def run_for_project(self, project_id: str, scheduled_for: datetime) -> dict:
        now = get_now()
        logger.info("Running %s for project %s at %s", AGENT_KEY, project_id, now.isoformat())

        # 1. Trigger the scope-creep check through the Next.js Internal API.
        result = await self.client.trigger_scope_creep_check(project_id)

        # 2. Record the run outcome (upsert on agentKey/projectId/scheduledFor).
        await self.client.record_run(
            {
                "agentKey": AGENT_KEY,
                "projectId": project_id,
                "scheduledFor": scheduled_for.isoformat(),
                "status": "SUCCESS" if result else "FAILED",
                "result": result or {},
                "tokenCount": 0,
            }
        )

        if not result:
            # Raising keeps the supervisor from overwriting the FAILED run as SUCCESS.
            raise ScopeCreepCheckFailed(f"Scope creep check returned no result for project {project_id}")

        logger.info("%s finished for project %s: %s", AGENT_KEY, project_id, result)
        return {**result, "tokenCount": 0}

    async def handle_event(self, event: dict) -> None:
        """DomainEvent handler for TASK_SPRINT_ADDED / TASK_CREATED.

        Runs outside the supervisor: no AgentRun row, no rate-limit claim. That
        bookkeeping is reserved for the scheduled 09:00 sweep. A missing
        `projectId` in the payload is logged and skipped rather than raised, so
        one malformed event never kills the poller's batch loop.
        """
        payload = event.get("payload") or {}
        project_id = payload.get("projectId")
        if not project_id:
            logger.warning("%s event missing projectId: %s", event.get("type"), payload)
            return
        await self.client.trigger_scope_creep_check(project_id)
