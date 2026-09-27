"""APScheduler configuration (ADR-034 §C).

Daily supervisor run at SCHEDULE_HOUR:00 in TZ (default 09:00 Europe/Istanbul),
plus three Step 6.05 jobs that run OUTSIDE the single daily supervisor sweep
because they don't fit its one-slot-per-day model: Agent-005's two fixed daily
phases (09:30 open / 11:30 cutoff) and Agent-006's weekly Friday 17:00 digest.
See `agent_005.py` / `agent_006.py` module docstrings for why these two agents
are not registered in the `supervisor` agent registry.
"""

from __future__ import annotations

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src import supervisor
from src.agents.agent_005 import PHASE_CUTOFF, PHASE_OPEN, STANDUP_CUTOFF_HOUR, STANDUP_CUTOFF_MINUTE, STANDUP_OPEN_HOUR, STANDUP_OPEN_MINUTE, run_standup_phase
from src.agents.agent_006 import WEEKLY_DIGEST_HOUR, WEEKLY_DIGEST_MINUTE, run_weekly_digest
from src.config import settings
from src.internal_client import InternalClient

DAILY_JOB_ID = "agent-000-daily"
STANDUP_OPEN_JOB_ID = "agent-005-standup-open"
STANDUP_CUTOFF_JOB_ID = "agent-005-standup-cutoff"
WEEKLY_DIGEST_JOB_ID = "agent-006-weekly-digest"


def build_daily_trigger(hour: int | None = None, tz: str | None = None) -> CronTrigger:
    return CronTrigger(
        hour=settings.SCHEDULE_HOUR if hour is None else hour,
        minute=0,
        timezone=pytz.timezone(tz or settings.TZ),
    )


async def _run_standup_open_job() -> None:
    await run_standup_phase(InternalClient(), PHASE_OPEN)


async def _run_standup_cutoff_job() -> None:
    await run_standup_phase(InternalClient(), PHASE_CUTOFF)


async def _run_weekly_digest_job() -> None:
    await run_weekly_digest(InternalClient())


def create_scheduler() -> AsyncIOScheduler:
    """Must be called from inside a running asyncio loop (AsyncIOScheduler binds to it on start)."""
    zone = pytz.timezone(settings.TZ)
    scheduler = AsyncIOScheduler(timezone=zone)
    scheduler.add_job(
        supervisor.run_daily_agents,
        trigger=build_daily_trigger(),
        id=DAILY_JOB_ID,
        name="Agent-000 daily supervisor run",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        _run_standup_open_job,
        trigger=CronTrigger(hour=STANDUP_OPEN_HOUR, minute=STANDUP_OPEN_MINUTE, timezone=zone),
        id=STANDUP_OPEN_JOB_ID,
        name="Agent-005 standup open (09:30)",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=1800,
    )
    scheduler.add_job(
        _run_standup_cutoff_job,
        trigger=CronTrigger(hour=STANDUP_CUTOFF_HOUR, minute=STANDUP_CUTOFF_MINUTE, timezone=zone),
        id=STANDUP_CUTOFF_JOB_ID,
        name="Agent-005 standup cutoff/synthesize (11:30)",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=1800,
    )
    scheduler.add_job(
        _run_weekly_digest_job,
        trigger=CronTrigger(day_of_week="fri", hour=WEEKLY_DIGEST_HOUR, minute=WEEKLY_DIGEST_MINUTE, timezone=zone),
        id=WEEKLY_DIGEST_JOB_ID,
        name="Agent-006 weekly sprint digest (Fri 17:00)",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    return scheduler
