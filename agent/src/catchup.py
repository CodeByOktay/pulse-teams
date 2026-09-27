"""Startup catch-up (spec 6.01 §4.6, ADR-034 §D).

On container start:
  1. Load enabled AgentSettings rows.
  2. Compute today's slot (SCHEDULE_HOUR:00 Europe/Istanbul).
  3. For each (agentKey, projectId) with no AgentRun for that slot, and only if the
     slot time has already passed, trigger the agent once through the supervisor.
Only the most recent missed slot (today) is caught up, never N missed days.
The AgentRun @@unique constraint (claimed by the supervisor) prevents duplicates
even if the scheduler fires concurrently.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Iterable, Optional

from src import supervisor
from src.clock import get_now
from src.config import settings as app_settings

logger = logging.getLogger("agent.catchup")


def plan_catchup(
    settings_rows: Iterable[Any],
    existing_run_keys: set[tuple[str, str]],
    now: datetime,
    scheduled_for: datetime,
    registered_agent_keys: Optional[Iterable[str]] = None,
) -> list[tuple[str, str]]:
    """Pure planner: ordered (agentKey, projectId) pairs that need a catch-up run."""
    registered = set(registered_agent_keys) if registered_agent_keys is not None else None
    pairs: set[tuple[str, str]] = set()
    for row in settings_rows or ():
        agent_key = supervisor.row_field(row, "agentKey")
        project_id = supervisor.row_field(row, "projectId")
        if not agent_key or not project_id or not supervisor.row_field(row, "enabled"):
            continue
        if registered is not None and agent_key not in registered:
            continue
        has_run = (agent_key, project_id) in existing_run_keys
        if supervisor.should_run_catchup(now, scheduled_for, has_run):
            pairs.add((agent_key, project_id))

    order = {k: i for i, k in enumerate(supervisor.sort_agent_keys(k for k, _ in pairs))}
    return sorted(pairs, key=lambda p: (order[p[0]], p[1]))


async def run_startup_catchup(now: Optional[datetime] = None) -> list[tuple[str, str, str]]:
    """Trigger missed runs for today's slot. Returns (agentKey, projectId, status) tuples."""
    current = now if now is not None else get_now()
    scheduled_for = supervisor.compute_scheduled_for(current, app_settings.SCHEDULE_HOUR, app_settings.TZ)
    if current < scheduled_for:
        logger.info("Catch-up: before today's slot %s, nothing to do", scheduled_for.isoformat())
        return []

    registered = supervisor.get_registered_agent_keys()
    if not registered:
        logger.info("Catch-up: no agents registered")
        return []

    rows = await supervisor.load_agent_settings(enabled_only=True)
    existing = await supervisor.load_existing_run_keys(scheduled_for)
    plan = plan_catchup(rows, existing, current, scheduled_for, registered)

    outcomes: list[tuple[str, str, str]] = []
    for agent_key, project_id in plan:
        status = await supervisor.run_agent(agent_key, project_id, scheduled_for, settings_rows=rows)
        outcomes.append((agent_key, project_id, status))
    logger.info("Catch-up for %s: %d run(s) triggered", scheduled_for.isoformat(), len(outcomes))
    return outcomes
