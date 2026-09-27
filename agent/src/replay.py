"""Slot Replay engine (Step 6.08, ADR-036).

APScheduler fires strictly on wall-clock time. When `SystemClock.mockTime` jumps
forward (simulated time travel, e.g. "+7 days" from the AgentSettings UI), every
cron slot that would have fired in between never actually runs -- the daily
09:00 supervisor sweep, Agent-005's 09:30/11:30 standup phases, and Agent-006's
Friday 17:00 weekly digest are all silently skipped.

Next.js emits a `CLOCK_ADVANCED` DomainEvent (`{"previous": <ISO>, "current":
<ISO>, "actorId": ...}`) whenever the clock is moved forward. This module:

  1. `plan_missed_slots` -- pure, DB-free planning of every skipped cron slot in
     the half-open interval `(previous, current]`, capped at a trailing
     `max_days` window and chronologically ordered.
  2. `execute_replay` -- runs each planned slot with `get_now()` pinned to the
     slot's own `fire_at` time (`src.clock.now_override`), so every agent and
     Internal API call evaluates the world as it stood at that historical
     instant rather than at real wall-clock "now". Each slot's own time becomes
     its `scheduledFor`, so the `AgentRun @@unique(["agentKey","projectId",
     "scheduledFor"])` constraint makes replaying an already-completed slot a
     safe no-op (idempotent, per ADR-036).
  3. `handle_clock_advanced` -- the DomainEvent poller handler for
     `CLOCK_ADVANCED`. It plans the slots and hands them off to a *background*
     asyncio task rather than awaiting the replay inline: a 14-day jump can
     produce hundreds of Internal API calls, and the poller enforces a
     per-handler timeout well under its lease duration (see
     `agent/src/poller.py` / `agent/src/config.py`). The handler itself
     therefore returns quickly (event -> DONE); recovery from a crash mid-replay
     is simply advancing the clock again, since AgentRun idempotency means no
     slot is ever double-applied.
  4. `close_replay` -- awaits (with a grace period) or cancels any in-flight
     background replay tasks on graceful shutdown.

Concurrent `CLOCK_ADVANCED` events are serialized by a module-level
`asyncio.Lock` so two replay windows never interleave their slot execution.

Per ADR-034, Python only ever writes DomainEvent status, AgentRun and
AgentProposal rows directly; every other side effect (notifications, standup
rows, proposals, etc.) is reached through the signed Internal API, same as
every other agent in the catalog.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import Enum
from typing import List

import pytz

from src import supervisor
from src.agents.agent_005 import (
    PHASE_CUTOFF,
    PHASE_OPEN,
    STANDUP_CUTOFF_HOUR,
    STANDUP_CUTOFF_MINUTE,
    STANDUP_OPEN_HOUR,
    STANDUP_OPEN_MINUTE,
    run_standup_phase,
)
from src.agents.agent_006 import WEEKLY_DIGEST_HOUR, WEEKLY_DIGEST_MINUTE, run_weekly_digest
from src.clock import now_override
from src.config import settings
from src.internal_client import InternalClient

logger = logging.getLogger("agent.replay")

FRIDAY = 4  # datetime.weekday() -- Monday=0 .. Sunday=6


class ReplayJobType(str, Enum):
    DAILY = "daily"
    STANDUP_OPEN = "standup-open"
    STANDUP_CUTOFF = "standup-cutoff"
    WEEKLY_DIGEST = "weekly-digest"


# Declaration order above doubles as the same-instant tie-break order (contract).
_JOB_ORDER: dict[ReplayJobType, int] = {job: index for index, job in enumerate(ReplayJobType)}


@dataclass(frozen=True)
class ReplaySlot:
    fire_at: datetime  # aware datetime in the target timezone
    job: ReplayJobType


# ---------------------------------------------------------------------- #
# Pure planning
# ---------------------------------------------------------------------- #
def _to_tz(dt: datetime, tz: pytz.BaseTzInfo) -> datetime:
    """Naive datetimes are interpreted as UTC (matches how Prisma stores
    timestamps -- see `clock.sync_clock_from_db`); aware datetimes are converted."""
    if dt.tzinfo is None:
        return pytz.utc.localize(dt).astimezone(tz)
    return dt.astimezone(tz)


def _localize(tz: pytz.BaseTzInfo, day: date, hour: int, minute: int) -> datetime:
    """DST-safe construction of a local wall-clock instant via `pytz.localize`."""
    naive = datetime(day.year, day.month, day.day, hour, minute, 0)
    return tz.localize(naive)


def plan_missed_slots(
    previous: datetime,
    current: datetime,
    schedule_hour: int = 9,
    tz_name: str = "Europe/Istanbul",
    max_days: int = 14,
) -> List[ReplaySlot]:
    """Chronologically plans every cron slot that fell within `(previous, current]`.

    * `current <= previous` (clock held still or moved backward) -> `[]`, no replay.
    * Gaps wider than `max_days` are clamped to the trailing window
      `(current - max_days days, current]`; older skipped slots are dropped.
    * DAILY fires at `schedule_hour:00`; STANDUP_OPEN / STANDUP_CUTOFF and
      WEEKLY_DIGEST reuse Agent-005 / Agent-006's fixed times (WEEKLY_DIGEST only
      on Fridays).
    * Returned in chronological order; slots sharing the same instant are ordered
      by `ReplayJobType` declaration order (DAILY, STANDUP_OPEN, STANDUP_CUTOFF,
      WEEKLY_DIGEST).
    """
    tz = pytz.timezone(tz_name)
    prev = _to_tz(previous, tz)
    curr = _to_tz(current, tz)
    if curr <= prev:
        return []

    if curr - prev > timedelta(days=max_days):
        prev = curr - timedelta(days=max_days)

    slots: List[ReplaySlot] = []
    day = prev.date()
    last_day = curr.date()
    while day <= last_day:
        candidates = [
            (schedule_hour, 0, ReplayJobType.DAILY),
            (STANDUP_OPEN_HOUR, STANDUP_OPEN_MINUTE, ReplayJobType.STANDUP_OPEN),
            (STANDUP_CUTOFF_HOUR, STANDUP_CUTOFF_MINUTE, ReplayJobType.STANDUP_CUTOFF),
        ]
        if day.weekday() == FRIDAY:
            candidates.append((WEEKLY_DIGEST_HOUR, WEEKLY_DIGEST_MINUTE, ReplayJobType.WEEKLY_DIGEST))
        for hour, minute, job in candidates:
            fire_at = _localize(tz, day, hour, minute)
            if prev < fire_at <= curr:
                slots.append(ReplaySlot(fire_at=fire_at, job=job))
        day += timedelta(days=1)

    slots.sort(key=lambda slot: (slot.fire_at, _JOB_ORDER[slot.job]))
    return slots


# ---------------------------------------------------------------------- #
# Execution
# ---------------------------------------------------------------------- #
async def execute_replay(slots: List[ReplaySlot], client: InternalClient) -> dict[str, int]:
    """Runs each planned slot with `get_now()` pinned to its own `fire_at` time.

    Every slot is independent: a failing slot is logged and counted, never
    aborting the rest of the replay (a later slot may well depend on an earlier
    one's side effects, but a single bad Internal API call must not blank out an
    entire replay window). Returns per-job-type counters, with `<job>_failed`
    entries for slots that raised.
    """
    counters: dict[str, int] = {}
    for slot in slots:
        key = slot.job.value
        try:
            with now_override(slot.fire_at):
                if slot.job is ReplayJobType.DAILY:
                    await supervisor.run_daily_agents(now=slot.fire_at)
                elif slot.job is ReplayJobType.STANDUP_OPEN:
                    await run_standup_phase(client, PHASE_OPEN, now=slot.fire_at)
                elif slot.job is ReplayJobType.STANDUP_CUTOFF:
                    await run_standup_phase(client, PHASE_CUTOFF, now=slot.fire_at)
                elif slot.job is ReplayJobType.WEEKLY_DIGEST:
                    await run_weekly_digest(client, now=slot.fire_at)
            counters[key] = counters.get(key, 0) + 1
        except Exception:
            logger.exception("Slot replay failed: %s at %s", key, slot.fire_at.isoformat())
            failed_key = f"{key}_failed"
            counters[failed_key] = counters.get(failed_key, 0) + 1
    return counters


# ---------------------------------------------------------------------- #
# DomainEvent handler + background task lifecycle
# ---------------------------------------------------------------------- #
_replay_lock = asyncio.Lock()
_running_tasks: set[asyncio.Task] = set()


def _parse_event_timestamp(raw: object) -> datetime:
    if not isinstance(raw, str) or not raw:
        raise ValueError(f"expected an ISO 8601 string, got {raw!r}")
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


async def _run_replay_serialized(slots: List[ReplaySlot], client: InternalClient) -> None:
    """Serializes concurrent `CLOCK_ADVANCED` replays so two windows never interleave."""
    async with _replay_lock:
        try:
            counters = await execute_replay(slots, client)
            logger.info("Slot replay finished: %d slot(s) -> %s", len(slots), counters)
        except Exception:
            logger.exception("Slot replay crashed (recoverable by advancing the clock again)")


async def handle_clock_advanced(event: dict) -> None:
    """DomainEvent handler for `CLOCK_ADVANCED`, registered in `agents/__init__.py`.

    Plans the missed slots and launches the actual replay as a background task so
    the handler itself (and therefore the poller's per-event lease) returns
    quickly; see the module docstring for the rationale.
    """
    payload = event.get("payload") or {}
    try:
        previous = _parse_event_timestamp(payload.get("previous"))
        current = _parse_event_timestamp(payload.get("current"))
    except ValueError:
        logger.warning("CLOCK_ADVANCED event has missing/unparseable previous or current: %s", payload)
        return

    slots = plan_missed_slots(
        previous,
        current,
        schedule_hour=settings.SCHEDULE_HOUR,
        tz_name=settings.TZ,
    )
    if not slots:
        logger.info(
            "CLOCK_ADVANCED: no missed slots to replay (previous=%s, current=%s)",
            payload.get("previous"),
            payload.get("current"),
        )
        return

    client = InternalClient()
    task = asyncio.create_task(_run_replay_serialized(slots, client), name="clock-advanced-replay")
    _running_tasks.add(task)
    task.add_done_callback(_running_tasks.discard)
    logger.info("CLOCK_ADVANCED: scheduled background replay of %d missed slot(s)", len(slots))


async def close_replay(timeout: float = 10.0) -> None:
    """Graceful shutdown: waits up to `timeout`s for in-flight replays to finish
    naturally, then cancels and awaits whatever is left.

    Replays are idempotent via the `AgentRun` unique constraint, so a replay cut
    short here is safely recovered later by advancing the clock again.
    """
    tasks = [t for t in _running_tasks if not t.done()]
    if not tasks:
        return
    _done, pending = await asyncio.wait(tasks, timeout=max(0.0, timeout))
    for task in pending:
        task.cancel()
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
