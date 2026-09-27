"""Agent-007 — Workload Balancer (Step 6.06, ADR-034).

Deterministic dispatch, LLM tokens spent server-side (Next.js
`analyzeWorkloadReassignment`), zero tokens spent in this container. Same shape as
Agent-001/002/004 (`agent_001.py` / `agent_002.py` / `agent_004.py`): a single
Internal API round trip per project, reported to `AgentRun`. All rule logic
(workload scoring, imbalance detection, candidate task selection, LLM-assisted
reassignment suggestion, `AgentProposal` creation with `suggestedAssigneeId`, ADMIN
notification) lives in the Next.js service `dispatchWorkloadCheck`
(src/lib/workload-service.ts), reached via POST /api/internal/agent/workload-check.

Tier C (spec 6.06 §2): reassignment is NEVER applied automatically. This agent only
ever triggers the creation of a PENDING `AgentProposal` for a human PM/ADMIN to
approve via `approveProposal`. Daily-supervisor-only -- no event trigger in scope.
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.clock import get_now
from src.internal_client import InternalClient

logger = logging.getLogger("agent.007")

AGENT_KEY = "agent-007"


class WorkloadCheckFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the supervisor records FAILED."""


class WorkloadBalancerAgent:
    def __init__(self, internal_client: InternalClient):
        self.client = internal_client

    async def run_for_project(self, project_id: str, scheduled_for: datetime) -> dict:
        now = get_now()
        logger.info("Running %s for project %s at %s", AGENT_KEY, project_id, now.isoformat())

        result = await self.client.trigger_workload_check(project_id)

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
            raise WorkloadCheckFailed(f"Workload check returned no result for project {project_id}")

        logger.info("%s finished for project %s: %s", AGENT_KEY, project_id, result)
        return {**result, "tokenCount": 0}
