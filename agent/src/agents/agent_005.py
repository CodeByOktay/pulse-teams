"""Agent-005 — Async Daily Standup (Step 6.05, ADR-034 Tier B).

Two independent daily phases, each its own APScheduler cron job (see
`src/scheduler.py`): 09:30 "open" and 11:30 "cutoff/synthesize". Both phases
share the agentKey "agent-005" but run at different fixed times of day, which
does not fit the single-slot-per-day `supervisor.run_daily_agents` model (one
`SCHEDULE_HOUR:00` for every registered agent). For this reason
`DailyStandupAgent` is intentionally NOT registered in the `supervisor` agent
registry (`register_agent`) — registering it would also make `run_daily_agents`
fire an unwanted third invocation at `SCHEDULE_HOUR:00` (09:00 by default).

Each phase reimplements the supervisor's claim/execute/complete contract
directly (`supervisor.claim_run` / `supervisor.complete_run`) so both phases
still produce their own AgentRun row -- same agentKey, different
`scheduledFor` instants (09:30 vs 11:30 today). The `@@unique("agentKey",
"projectId", "scheduledFor")` constraint keeps them distinct and atomically
rate-limited, and both remain visible in the dashboard Agent Activity widget.

All rule logic (idempotent daily-row upsert, cutoff enforcement, LLM
synthesis / heuristic fallback, same-day dedup) lives in the Next.js services
`openTodayStandup` / `synthesizeStandup`, reached through
POST /api/internal/agent/standup-open and /standup-synthesize.
"""

from __future__ import annotations

import logging
from datetime import datetime, tzinfo
from typing import Optional, Union

import pytz

from src.clock import get_now
from src.config import settings as app_settings
from src import supervisor
from src.internal_client import InternalClient

logger = logging.getLogger("agent.005")

AGENT_KEY = "agent-005"

STANDUP_OPEN_HOUR = 9
STANDUP_OPEN_MINUTE = 30
STANDUP_CUTOFF_HOUR = 11
STANDUP_CUTOFF_MINUTE = 30

PHASE_OPEN = "open"
PHASE_CUTOFF = "cutoff"


class StandupCheckFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the run is recorded FAILED."""


def compute_phase_time(
    now: datetime,
    hour: int,
    minute: int,
    tz: Union[str, tzinfo, None] = None,
) -> datetime:
    """Today's HH:MM in `tz` (default settings.TZ) as an aware datetime.

    Same "today in tz" resolution as `supervisor.compute_scheduled_for`, extended
    with minute granularity (agent-005's two phases are 30 minutes past the hour).
    """
    zone = pytz.timezone(tz) if isinstance(tz, str) else (tz or pytz.timezone(app_settings.TZ))
    if now.tzinfo is None:
        local_now = zone.localize(now) if hasattr(zone, "localize") else now.replace(tzinfo=zone)
    else:
        local_now = now.astimezone(zone)
    naive_target = datetime(local_now.year, local_now.month, local_now.day, hour, minute, 0)
    if hasattr(zone, "localize"):
        return zone.localize(naive_target)
    return naive_target.replace(tzinfo=zone)


class DailyStandupAgent:
    def __init__(self, internal_client: InternalClient):
        self.client = internal_client

    async def _run_phase(self, project_id: str, scheduled_for: datetime, phase: str) -> str:
        """Claim -> call Internal API -> complete, mirroring `supervisor.run_agent`
        without going through the registry (see module docstring)."""
        run_id = await supervisor.claim_run(AGENT_KEY, project_id, scheduled_for)
        if run_id is None:
            logger.info("%s (%s) already ran for project %s at %s", AGENT_KEY, phase, project_id, scheduled_for)
            return "DUPLICATE"

        status, result, error = supervisor.RUN_SUCCESS, None, None
        try:
            if phase == PHASE_OPEN:
                result = await self.client.trigger_standup_open(project_id)
            else:
                result = await self.client.trigger_standup_synthesize(project_id)
            if not result:
                raise StandupCheckFailed(f"{phase} check returned no result for project {project_id}")
        except Exception as exc:
            status, error = supervisor.RUN_FAILED, supervisor.truncate_error(exc)
            logger.exception("%s (%s) failed for project %s", AGENT_KEY, phase, project_id)

        try:
            await supervisor.complete_run(
                run_id, status, result=result if isinstance(result, dict) else None, error=error
            )
        except Exception:
            logger.exception("Failed to record AgentRun %s (%s/%s) as %s", run_id, AGENT_KEY, phase, status)
        return status

    async def open_standup(self, project_id: str, scheduled_for: datetime) -> str:
        return await self._run_phase(project_id, scheduled_for, PHASE_OPEN)

    async def close_standup(self, project_id: str, scheduled_for: datetime) -> str:
        return await self._run_phase(project_id, scheduled_for, PHASE_CUTOFF)


async def run_standup_phase(
    client: InternalClient,
    phase: str,
    now: Optional[datetime] = None,
) -> dict[str, int]:
    """Scheduler entry point for one phase, across every agent-005-enabled project.

    Called by two separate APScheduler cron jobs (09:30 / 11:30) in `scheduler.py`.
    """
    current = now if now is not None else get_now()
    hour, minute = (STANDUP_OPEN_HOUR, STANDUP_OPEN_MINUTE) if phase == PHASE_OPEN else (
        STANDUP_CUTOFF_HOUR,
        STANDUP_CUTOFF_MINUTE,
    )
    scheduled_for = compute_phase_time(current, hour, minute, app_settings.TZ)

    rows = await supervisor.load_agent_settings(enabled_only=True)
    project_ids = sorted({r["projectId"] for r in rows if r["agentKey"] == AGENT_KEY})

    agent = DailyStandupAgent(client)
    counts: dict[str, int] = {}
    for project_id in project_ids:
        status = await agent._run_phase(project_id, scheduled_for, phase)
        counts[status] = counts.get(status, 0) + 1
    logger.info("%s (%s) for %s finished: %s", AGENT_KEY, phase, scheduled_for.isoformat(), counts)
    return counts
