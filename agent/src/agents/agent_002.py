"""Agent-002 — Task Hygiene (Step 6.03, ADR-034).

Deterministic, zero LLM tokens. Same shape as Agent-001 (`agent_001.py`): a
single Internal API round trip per project, reported to `AgentRun`. All rule
logic (unassigned / missing-due-date / insufficient-description detection,
same-day idempotency, ADMIN recipients) lives in the Next.js service
`dispatchTaskHygieneReport`, reached via POST /api/internal/agent/hygiene-check.

Per ADR-034 §D (hygiene first -> deadline -> status), Agent-002 runs before
Agent-001 in the supervisor's catch-up/daily priority order (see
`supervisor.AGENT_PRIORITY`).
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.clock import get_now
from src.internal_client import InternalClient

logger = logging.getLogger("agent.002")

AGENT_KEY = "agent-002"


class HygieneCheckFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the supervisor records FAILED."""


class TaskHygieneAgent:
    def __init__(self, internal_client: InternalClient):
        self.client = internal_client

    async def run_for_project(self, project_id: str, scheduled_for: datetime) -> dict:
        now = get_now()
        logger.info("Running %s for project %s at %s", AGENT_KEY, project_id, now.isoformat())

        result = await self.client.trigger_hygiene_check(project_id)

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
            raise HygieneCheckFailed(f"Hygiene check returned no result for project {project_id}")

        logger.info("%s finished for project %s: %s", AGENT_KEY, project_id, result)
        return {**result, "tokenCount": 0}
