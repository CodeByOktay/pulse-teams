"""Agent-006 — Weekly Sprint Digest (Step 6.05, ADR-034 Tier B).

Runs once a week (Friday 17:00 Europe/Istanbul, see `src/scheduler.py`), not
daily -- so, like Agent-005 (see `agent_005.py` for the full rationale), it is
intentionally NOT registered in the `supervisor` agent registry: registering
it would make `run_daily_agents` also fire it every day at `SCHEDULE_HOUR:00`.

Reimplements the supervisor's claim/execute/complete contract directly
(`supervisor.claim_run` / `supervisor.complete_run`) so each Friday run still
produces its own AgentRun row (agentKey "agent-006"), visible in the
dashboard Agent Activity widget.

All rule logic (active-sprint lookup, metric calculation, sprint health
status, LLM digest / heuristic fallback, same-week dedup) lives in the
Next.js service `dispatchWeeklyDigest`, reached through
POST /api/internal/agent/weekly-digest.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from src.agents.agent_005 import compute_phase_time
from src.clock import get_now
from src.config import settings as app_settings
from src import supervisor
from src.internal_client import InternalClient

logger = logging.getLogger("agent.006")

AGENT_KEY = "agent-006"

WEEKLY_DIGEST_HOUR = 17
WEEKLY_DIGEST_MINUTE = 0


class WeeklyDigestFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the run is recorded FAILED."""


class WeeklyDigestAgent:
    def __init__(self, internal_client: InternalClient):
        self.client = internal_client

    async def run_for_project(self, project_id: str, scheduled_for: datetime) -> str:
        """Claim -> call Internal API -> complete, mirroring `supervisor.run_agent`
        without going through the registry (see module docstring)."""
        run_id = await supervisor.claim_run(AGENT_KEY, project_id, scheduled_for)
        if run_id is None:
            logger.info("%s already ran for project %s at %s", AGENT_KEY, project_id, scheduled_for)
            return "DUPLICATE"

        status, result, error = supervisor.RUN_SUCCESS, None, None
        try:
            result = await self.client.trigger_weekly_digest(project_id)
            if not result:
                raise WeeklyDigestFailed(f"Weekly digest returned no result for project {project_id}")
        except Exception as exc:
            status, error = supervisor.RUN_FAILED, supervisor.truncate_error(exc)
            logger.exception("%s failed for project %s", AGENT_KEY, project_id)

        try:
            await supervisor.complete_run(
                run_id, status, result=result if isinstance(result, dict) else None, error=error
            )
        except Exception:
            logger.exception("Failed to record AgentRun %s (%s) as %s", run_id, AGENT_KEY, status)
        return status


async def run_weekly_digest(client: InternalClient, now: Optional[datetime] = None) -> dict[str, int]:
    """Scheduler entry point, across every agent-006-enabled project.

    Called by the Friday 17:00 APScheduler cron job in `scheduler.py`.
    """
    current = now if now is not None else get_now()
    scheduled_for = compute_phase_time(current, WEEKLY_DIGEST_HOUR, WEEKLY_DIGEST_MINUTE, app_settings.TZ)

    rows = await supervisor.load_agent_settings(enabled_only=True)
    project_ids = sorted({r["projectId"] for r in rows if r["agentKey"] == AGENT_KEY})

    agent = WeeklyDigestAgent(client)
    counts: dict[str, int] = {}
    for project_id in project_ids:
        status = await agent.run_for_project(project_id, scheduled_for)
        counts[status] = counts.get(status, 0) + 1
    logger.info("%s for %s finished: %s", AGENT_KEY, scheduled_for.isoformat(), counts)
    return counts
