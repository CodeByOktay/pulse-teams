"""Agent-001 — Deadline Tracker (Step 6.02, ADR-034).

Deterministic, zero LLM tokens. Triggered daily at 09:00 Europe/Istanbul (or by the
startup catch-up) through the Agent-000 supervisor, which has already checked that
agent-001 is enabled for the project and claimed the AgentRun slot.

All rule logic (3/1/0-day reminders, overdue escalation to ADMINs, same-day
idempotency, notification preferences) lives in the Next.js service
`dispatchDueDateReminders`, reached via POST /api/internal/agent/deadline-check.
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.clock import get_now
from src.internal_client import InternalClient

logger = logging.getLogger("agent.001")

AGENT_KEY = "agent-001"


class DeadlineCheckFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the supervisor records FAILED."""


class DeadlineTrackerAgent:
    def __init__(self, internal_client: InternalClient):
        self.client = internal_client

    async def run_for_project(self, project_id: str, scheduled_for: datetime) -> dict:
        now = get_now()
        logger.info("Running %s for project %s at %s", AGENT_KEY, project_id, now.isoformat())

        # 1. Trigger the deadline check through the Next.js Internal API.
        result = await self.client.trigger_deadline_check(project_id)

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
            raise DeadlineCheckFailed(f"Deadline check returned no result for project {project_id}")

        logger.info("%s finished for project %s: %s", AGENT_KEY, project_id, result)
        return {**result, "tokenCount": 0}
