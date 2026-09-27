"""Agent-008 — Sprint Assistant (Step 6.06, ADR-034).

Two independent triggers, both deterministic dispatch (zero LLM tokens spent in this
container -- the retro draft's LLM call, if any, happens server-side in Next.js):

  * Scheduled: `run_for_project` -- same shape as Agent-001/002/004/007, goes through
    the supervisor's AgentRun claim/rate-limit. Calls
    `POST /api/internal/agent/sprint-overflow-check`, which owns the 2-days-before-end
    overflow warning rule (`dispatchSprintOverflowCheck`, src/lib/sprint-assistant-service.ts).
  * Event-driven: `handle_event`, registered for `SPRINT_COMPLETED` in `agents/__init__.py`.
    Mirrors Agent-004's event handler: a lightweight fire-and-forget outside the
    supervisor's AgentRun bookkeeping (reserved for the scheduled slot). Calls
    `POST /api/internal/agent/sprint-retro`, which owns retrospective aggregation and
    publishing (`dispatchSprintRetro`). A malformed event (missing `projectId` or
    `sprintId`) is logged and skipped rather than raised, so one bad event never kills
    the poller's batch loop.
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.clock import get_now
from src.internal_client import InternalClient

logger = logging.getLogger("agent.008")

AGENT_KEY = "agent-008"


class SprintOverflowCheckFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the supervisor records FAILED."""


class SprintAssistantAgent:
    def __init__(self, internal_client: InternalClient):
        self.client = internal_client

    async def run_for_project(self, project_id: str, scheduled_for: datetime) -> dict:
        now = get_now()
        logger.info("Running %s for project %s at %s", AGENT_KEY, project_id, now.isoformat())

        result = await self.client.trigger_sprint_overflow_check(project_id)

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
            raise SprintOverflowCheckFailed(
                f"Sprint overflow check returned no result for project {project_id}"
            )

        logger.info("%s finished for project %s: %s", AGENT_KEY, project_id, result)
        return {**result, "tokenCount": 0}

    async def handle_event(self, event: dict) -> None:
        """DomainEvent handler for SPRINT_COMPLETED.

        Runs outside the supervisor: no AgentRun row, no rate-limit claim. A missing
        `projectId` or `sprintId` in the payload is logged and skipped rather than
        raised, so one malformed event never kills the poller's batch loop.
        """
        payload = event.get("payload") or {}
        project_id = payload.get("projectId")
        sprint_id = payload.get("sprintId")
        if not project_id or not sprint_id:
            logger.warning("%s event missing projectId/sprintId: %s", event.get("type"), payload)
            return
        await self.client.trigger_sprint_retro(project_id, sprint_id)
