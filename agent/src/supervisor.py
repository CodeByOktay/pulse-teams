"""Agent-000 Supervisor.

Responsibilities (spec 6.01 §4.7 / ADR-034):
  * Agent registry: which agent coroutine handles which `agentKey`.
  * Enablement: an agent runs for a project only when its `AgentSettings.enabled` is true.
  * Rate limiting: at most one run per (agentKey, projectId, scheduledFor day). The run
    slot is claimed with `INSERT ... ON CONFLICT ("agentKey","projectId","scheduledFor")
    DO NOTHING RETURNING id`; the `@@unique` constraint makes the claim atomic, so a
    concurrent scheduler tick / catch-up can never double-run the same job.
  * Error capture: agent exceptions are recorded on the AgentRun row (status FAILED + error).

Agent contract:
    async def agent(project_id: str, scheduled_for: datetime) -> dict | None
The returned dict (if any) is stored in `AgentRun.result`; an int `tokenCount` key is
also copied to `AgentRun.tokenCount`.
"""

from __future__ import annotations

import logging
from datetime import datetime, tzinfo
from typing import Any, Awaitable, Callable, Iterable, Optional, Union

import pytz

from src.clock import get_now, get_now_override
from src.config import settings as app_settings
from src.db import generate_id, get_db_connection, to_json, to_utc_naive

logger = logging.getLogger("agent.supervisor")

SUPERVISOR_KEY = "agent-000"

RUN_RUNNING = "RUNNING"
RUN_SUCCESS = "SUCCESS"
RUN_FAILED = "FAILED"
RUN_SKIPPED = "SKIPPED"

# ADR-034 §D: hygiene -> deadline -> blocker -> scope creep -> status (clean data priority;
# guardian checks run before Agent-003 opens a human-wait status request).
AGENT_PRIORITY: tuple[str, ...] = (
    "agent-002",
    "agent-001",
    "agent-004",
    "agent-009",
    "agent-003",
    "agent-007",
    "agent-008",
)

MAX_ERROR_LENGTH = 2000

AgentCallable = Callable[[str, datetime], Awaitable[Optional[dict]]]

_AGENTS: dict[str, AgentCallable] = {}


# ---------------------------------------------------------------------- #
# Registry
# ---------------------------------------------------------------------- #
def register_agent(agent_key: str, coroutine: AgentCallable) -> None:
    _AGENTS[agent_key] = coroutine


def unregister_agent(agent_key: str) -> None:
    _AGENTS.pop(agent_key, None)


def clear_agents() -> None:
    _AGENTS.clear()


def get_agent(agent_key: str) -> Optional[AgentCallable]:
    return _AGENTS.get(agent_key)


def get_registered_agent_keys() -> list[str]:
    return sort_agent_keys(_AGENTS.keys())


# ---------------------------------------------------------------------- #
# Pure helpers
# ---------------------------------------------------------------------- #
def _resolve_tz(tz: Union[str, tzinfo, None]) -> tzinfo:
    if tz is None:
        return pytz.timezone(app_settings.TZ)
    if isinstance(tz, str):
        return pytz.timezone(tz)
    return tz


def compute_scheduled_for(
    now: datetime,
    hour: int = 9,
    tz: Union[str, tzinfo, None] = "Europe/Istanbul",
) -> datetime:
    """Today's HH:00 (default 09:00) in `tz` as an aware datetime.

    "Today" is the calendar day of `now` expressed in `tz`. Naive `now` values are
    interpreted as wall-clock time in `tz`.
    """
    zone = _resolve_tz(tz)
    if now.tzinfo is None:
        local_now = zone.localize(now) if hasattr(zone, "localize") else now.replace(tzinfo=zone)
    else:
        local_now = now.astimezone(zone)
    naive_target = datetime(local_now.year, local_now.month, local_now.day, hour, 0, 0)
    if hasattr(zone, "localize"):
        return zone.localize(naive_target)
    return naive_target.replace(tzinfo=zone)


def should_run_catchup(now: datetime, scheduled_for: datetime, has_run: bool) -> bool:
    """Catch-up fires only once the scheduled time has passed and no run exists yet."""
    return (not has_run) and now >= scheduled_for


def is_agent_enabled(settings_rows: Iterable[Any], project_id: str, agent_key: str) -> bool:
    """True iff an AgentSettings row exists for (project, agent) with enabled = true.

    Missing rows are treated as disabled (agents are opt-in per project).
    Rows may be dicts (DB rows / API JSON) or objects with matching attributes.
    """
    for row in settings_rows or ():
        row_project = row_field(row, "projectId")
        row_key = row_field(row, "agentKey")
        if row_project == project_id and row_key == agent_key:
            return bool(row_field(row, "enabled"))
    return False


def sort_agent_keys(keys: Iterable[str]) -> list[str]:
    """Order keys by AGENT_PRIORITY, then remaining keys alphabetically."""
    priority = {k: i for i, k in enumerate(AGENT_PRIORITY)}
    return sorted(set(keys), key=lambda k: (priority.get(k, len(priority)), k))


def truncate_error(error: BaseException | str) -> str:
    text = error if isinstance(error, str) else f"{type(error).__name__}: {error}"
    return text[:MAX_ERROR_LENGTH]


def extract_token_count(result: Optional[dict]) -> int:
    if isinstance(result, dict):
        value = result.get("tokenCount")
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            return value
    return 0


def row_field(row: Any, name: str) -> Any:
    if isinstance(row, dict):
        return row.get(name)
    return getattr(row, name, None)


# ---------------------------------------------------------------------- #
# SQL
# ---------------------------------------------------------------------- #
CLAIM_RUN_SQL = (
    'INSERT INTO "AgentRun" ("id", "agentKey", "projectId", "status", "scheduledFor", "startedAt", "tokenCount", "createdAt") '
    "VALUES (%(id)s, %(agentKey)s, %(projectId)s, %(status)s, %(scheduledFor)s, %(now)s, 0, %(now)s) "
    'ON CONFLICT ("agentKey", "projectId", "scheduledFor") DO NOTHING '
    'RETURNING "id"'
)

COMPLETE_RUN_SQL = (
    'UPDATE "AgentRun" SET "status" = %(status)s, "completedAt" = %(completedAt)s, '
    '"result" = %(result)s, "error" = %(error)s, "tokenCount" = %(tokenCount)s '
    'WHERE "id" = %(id)s'
)

LOAD_SETTINGS_SQL = (
    'SELECT "id", "projectId", "agentKey", "enabled", "config", "pmUserId" FROM "AgentSettings"'
)

LOAD_RUN_KEYS_SQL = (
    'SELECT "agentKey", "projectId" FROM "AgentRun" WHERE "scheduledFor" = %(scheduledFor)s'
)


# ---------------------------------------------------------------------- #
# DB operations
# ---------------------------------------------------------------------- #
async def load_agent_settings(enabled_only: bool = False) -> list[dict]:
    sql = LOAD_SETTINGS_SQL + (' WHERE "enabled" = true' if enabled_only else "")
    async with get_db_connection() as conn:
        cur = await conn.execute(sql)
        return [dict(r) for r in await cur.fetchall()]


async def load_existing_run_keys(scheduled_for: datetime) -> set[tuple[str, str]]:
    """(agentKey, projectId) pairs that already have an AgentRun for this slot."""
    async with get_db_connection() as conn:
        cur = await conn.execute(LOAD_RUN_KEYS_SQL, {"scheduledFor": to_utc_naive(scheduled_for)})
        return {(r["agentKey"], r["projectId"]) for r in await cur.fetchall()}


async def claim_run(
    agent_key: str,
    project_id: str,
    scheduled_for: datetime,
    status: str = RUN_RUNNING,
) -> Optional[str]:
    """Atomically claim the (agent, project, slot) run. Returns run id, or None if taken."""
    params = {
        "id": generate_id(),
        "agentKey": agent_key,
        "projectId": project_id,
        "status": status,
        "scheduledFor": to_utc_naive(scheduled_for),
        "now": to_utc_naive(get_now()),
    }
    async with get_db_connection() as conn:
        cur = await conn.execute(CLAIM_RUN_SQL, params)
        row = await cur.fetchone()
    return row["id"] if row else None


def _with_replay_marker(result: Optional[dict]) -> Optional[dict]:
    """Merges `"replayed": True` into the AgentRun result when a Slot Replay override
    is active (Step 6.08 / ADR-036). This is the approved replay marker -- Notification
    has no metadata column and the schema is not being changed for it."""
    if get_now_override() is None:
        return result
    base = result if isinstance(result, dict) else {}
    return {**base, "replayed": True}


async def complete_run(
    run_id: str,
    status: str,
    result: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    result = _with_replay_marker(result)
    params = {
        "id": run_id,
        "status": status,
        "completedAt": to_utc_naive(get_now()),
        "result": to_json(result),
        "error": error,
        "tokenCount": extract_token_count(result),
    }
    async with get_db_connection() as conn:
        await conn.execute(COMPLETE_RUN_SQL, params)


# ---------------------------------------------------------------------- #
# Orchestration
# ---------------------------------------------------------------------- #
async def run_agent(
    agent_key: str,
    project_id: str,
    scheduled_for: datetime,
    settings_rows: Optional[Iterable[Any]] = None,
) -> str:
    """Run one agent for one project/slot under supervisor rules.

    Returns the final status: SUCCESS / FAILED / SKIPPED, or "DUPLICATE" when the slot
    was already claimed (rate limited) and "UNREGISTERED" when no agent is registered.
    """
    agent = get_agent(agent_key)
    if agent is None:
        logger.debug("No agent registered for %s; skipping project %s", agent_key, project_id)
        return "UNREGISTERED"

    if settings_rows is not None and not is_agent_enabled(settings_rows, project_id, agent_key):
        run_id = await claim_run(agent_key, project_id, scheduled_for, status=RUN_SKIPPED)
        if run_id is None:
            return "DUPLICATE"
        await complete_run(run_id, RUN_SKIPPED, result={"reason": "disabled"})
        logger.info("%s disabled for project %s -> SKIPPED", agent_key, project_id)
        return RUN_SKIPPED

    run_id = await claim_run(agent_key, project_id, scheduled_for)
    if run_id is None:
        logger.info("%s already ran for project %s at %s (rate limited)", agent_key, project_id, scheduled_for)
        return "DUPLICATE"

    status, result, error = RUN_SUCCESS, None, None
    try:
        result = await agent(project_id, scheduled_for)
    except Exception as exc:
        status, error = RUN_FAILED, truncate_error(exc)
        logger.exception("%s failed for project %s", agent_key, project_id)

    try:
        await complete_run(run_id, status, result=result if isinstance(result, dict) else None, error=error)
    except Exception:
        logger.exception("Failed to record AgentRun %s (%s) as %s", run_id, agent_key, status)
    return status


async def run_daily_agents(now: Optional[datetime] = None) -> dict[str, int]:
    """Scheduler entry point (APScheduler cron at SCHEDULE_HOUR:00 local time).

    Runs every registered agent for every project that has an AgentSettings row for it;
    disabled rows are recorded as SKIPPED.
    """
    current = now if now is not None else get_now()
    scheduled_for = compute_scheduled_for(current, app_settings.SCHEDULE_HOUR, app_settings.TZ)
    registered = set(get_registered_agent_keys())
    counts: dict[str, int] = {}
    if not registered:
        logger.info("Daily run: no agents registered")
        return counts

    rows = await load_agent_settings()
    for agent_key in sort_agent_keys(registered):
        project_ids = sorted({r["projectId"] for r in rows if r["agentKey"] == agent_key})
        for project_id in project_ids:
            status = await run_agent(agent_key, project_id, scheduled_for, settings_rows=rows)
            counts[status] = counts.get(status, 0) + 1
    logger.info("Daily run for %s finished: %s", scheduled_for.isoformat(), counts)
    return counts
