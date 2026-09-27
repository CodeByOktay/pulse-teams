"""APScheduler configuration (ADR-034 §C).

Daily supervisor run at SCHEDULE_HOUR:00 in TZ (default 09:00 Europe/Istanbul).
Extension point: additional cron jobs (e.g. weekly Friday 17:00 reports) are added
in `create_scheduler`.
"""

from __future__ import annotations

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src import supervisor
from src.config import settings

DAILY_JOB_ID = "agent-000-daily"


def build_daily_trigger(hour: int | None = None, tz: str | None = None) -> CronTrigger:
    return CronTrigger(
        hour=settings.SCHEDULE_HOUR if hour is None else hour,
        minute=0,
        timezone=pytz.timezone(tz or settings.TZ),
    )


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
    return scheduler
