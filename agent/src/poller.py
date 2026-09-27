"""DomainEvent outbox poller (`FOR UPDATE SKIP LOCKED` + leases).

Lifecycle of a DomainEvent row:
    PENDING --claim--> PROCESSING   (lockedAt = now, attempts += 1, error = NULL)
    PROCESSING --handler ok--> DONE       (processedAt = now)
    PROCESSING --handler raised--> FAILED (processedAt = now, error = handler error)
    PROCESSING --lease expired--> PENDING (attempts < EVENT_MAX_ATTEMPTS)
                                  FAILED  (attempts >= EVENT_MAX_ATTEMPTS, error = lease expiry)

Claiming happens in a short transaction so row locks are never held while
handlers run. Instead, each claim takes a time-bounded lease (`lockedAt`).
Any number of pulse-agent instances can run the lease sweep safely: only
PROCESSING rows whose lease is older than EVENT_LEASE_SECONDS are touched,
and `lockedAt` doubles as a fencing token — a consumer only finalizes an
event if the row still carries the `lockedAt` it claimed, so a slow consumer
whose lease was taken over can never overwrite the newer owner's result.

Handler failures are NOT retried automatically: handlers may have partial
side effects (e.g. notifications already sent), so they end in FAILED with
the error recorded. Only abandoned leases (crashed consumer) are re-queued.

Handlers are registered per event type via `register_handler`; unknown types
fall back to a logging no-op and are marked DONE.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Optional

from src.clock import get_now
from src.config import settings
from src.db import get_db_connection, to_utc_naive

logger = logging.getLogger("agent.poller")

STATUS_PENDING = "PENDING"
STATUS_PROCESSING = "PROCESSING"
STATUS_DONE = "DONE"
STATUS_FAILED = "FAILED"

MAX_ERROR_LENGTH = 2000

EventHandler = Callable[[dict], Awaitable[Any]]

_HANDLERS: dict[str, EventHandler] = {}


# ---------------------------------------------------------------------- #
# Handler registry
# ---------------------------------------------------------------------- #
async def default_handler(event: dict) -> None:
    logger.info("No handler registered for DomainEvent %s (%s); marking DONE", event.get("id"), event.get("type"))


def register_handler(event_type: str, handler: EventHandler) -> None:
    _HANDLERS[event_type] = handler


def unregister_handler(event_type: str) -> None:
    _HANDLERS.pop(event_type, None)


def clear_handlers() -> None:
    _HANDLERS.clear()


def get_handler(event_type: str) -> EventHandler:
    return _HANDLERS.get(event_type, default_handler)


# ---------------------------------------------------------------------- #
# Pure SQL builders
# ---------------------------------------------------------------------- #
def build_claim_select_sql() -> str:
    """Select a batch of PENDING events, skipping rows locked by other consumers."""
    return (
        'SELECT "id", "type", "payload", "status", "attempts", "createdAt" '
        'FROM "DomainEvent" '
        'WHERE "status" = %(status)s '
        'ORDER BY "createdAt" ASC '
        "LIMIT %(limit)s "
        "FOR UPDATE SKIP LOCKED"
    )


def build_claim_params(limit: int) -> dict:
    return {"status": STATUS_PENDING, "limit": max(1, int(limit))}


def build_mark_processing_sql() -> str:
    """Take the lease: status, lease start (fencing token), attempt counter."""
    return (
        'UPDATE "DomainEvent" '
        'SET "status" = %(status)s, "lockedAt" = %(lockedAt)s, "attempts" = "attempts" + 1, "error" = NULL '
        'WHERE "id" = ANY(%(ids)s)'
    )


def build_finalize_sql() -> str:
    """Finalize only if this consumer still owns the lease (fencing on lockedAt)."""
    return (
        'UPDATE "DomainEvent" '
        'SET "status" = %(status)s, "processedAt" = %(processedAt)s, "error" = %(error)s '
        'WHERE "id" = %(id)s AND "status" = %(processing)s AND "lockedAt" = %(lockedAt)s'
    )


def build_requeue_expired_sql() -> str:
    """Abandoned leases with attempts left go back to PENDING (lockedAt NULL = legacy row)."""
    return (
        'UPDATE "DomainEvent" '
        'SET "status" = %(pending)s, "lockedAt" = NULL, "error" = %(error)s '
        'WHERE "status" = %(processing)s '
        'AND ("lockedAt" IS NULL OR "lockedAt" < %(cutoff)s) '
        'AND "attempts" < %(maxAttempts)s'
    )


def build_fail_expired_sql() -> str:
    """Abandoned leases that exhausted their attempts become FAILED."""
    return (
        'UPDATE "DomainEvent" '
        'SET "status" = %(failed)s, "processedAt" = %(processedAt)s, "error" = %(error)s '
        'WHERE "status" = %(processing)s '
        'AND ("lockedAt" IS NULL OR "lockedAt" < %(cutoff)s) '
        'AND "attempts" >= %(maxAttempts)s'
    )


# ---------------------------------------------------------------------- #
# Pure helpers
# ---------------------------------------------------------------------- #
def decide_final_status(error: Optional[BaseException]) -> str:
    """DONE when the handler completed, FAILED when it raised."""
    return STATUS_DONE if error is None else STATUS_FAILED


def format_error(error: Optional[BaseException]) -> Optional[str]:
    """Compact `Type: message` string for the `error` column, capped in length."""
    if error is None:
        return None
    text = f"{type(error).__name__}: {error}".strip()
    if len(text) > MAX_ERROR_LENGTH:
        text = text[: MAX_ERROR_LENGTH - 3] + "..."
    return text


def compute_lease_cutoff(now: datetime, lease_seconds: int) -> datetime:
    """Leases that started before this (UTC naive) instant are expired."""
    return to_utc_naive(now) - timedelta(seconds=max(1, int(lease_seconds)))


def to_db_millis(dt: datetime) -> datetime:
    """UTC naive, truncated to milliseconds so it round-trips `timestamp(3)` exactly.

    Required for the `lockedAt` fencing comparison: Postgres would otherwise
    round microseconds on write and the equality check in finalize would miss.
    """
    utc = to_utc_naive(dt)
    return utc.replace(microsecond=(utc.microsecond // 1000) * 1000)


def build_lease_expired_message(lease_seconds: int) -> str:
    return f"Lease expired after {int(lease_seconds)}s (consumer crashed or handler hung)"


# ---------------------------------------------------------------------- #
# DB operations
# ---------------------------------------------------------------------- #
async def claim_pending_events(limit: int) -> list[dict]:
    """Claim a batch; each returned event carries the `lockedAt` it was claimed with."""
    locked_at = to_db_millis(get_now())
    async with get_db_connection() as conn:
        async with conn.transaction():
            cur = await conn.execute(build_claim_select_sql(), build_claim_params(limit))
            rows = await cur.fetchall()
            if rows:
                await conn.execute(
                    build_mark_processing_sql(),
                    {"status": STATUS_PROCESSING, "lockedAt": locked_at, "ids": [r["id"] for r in rows]},
                )
    events = []
    for r in rows:
        event = dict(r)
        event["lockedAt"] = locked_at
        event["attempts"] = int(event.get("attempts") or 0) + 1
        events.append(event)
    return events


async def finalize_event(
    event_id: str,
    status: str,
    locked_at: datetime,
    error: Optional[str] = None,
) -> bool:
    """Returns False when the lease was lost (another consumer took the event over)."""
    async with get_db_connection() as conn:
        cur = await conn.execute(
            build_finalize_sql(),
            {
                "status": status,
                "processedAt": to_utc_naive(get_now()),
                "error": error,
                "id": event_id,
                "processing": STATUS_PROCESSING,
                "lockedAt": locked_at,
            },
        )
        return (cur.rowcount or 0) > 0


async def recover_expired_leases(
    lease_seconds: Optional[int] = None,
    max_attempts: Optional[int] = None,
) -> dict:
    """Re-queue or fail PROCESSING events whose lease expired. Safe with multiple instances."""
    lease = lease_seconds if lease_seconds is not None else settings.EVENT_LEASE_SECONDS
    attempts = max_attempts if max_attempts is not None else settings.EVENT_MAX_ATTEMPTS
    now = get_now()
    params = {
        "pending": STATUS_PENDING,
        "failed": STATUS_FAILED,
        "processing": STATUS_PROCESSING,
        "cutoff": compute_lease_cutoff(now, lease),
        "maxAttempts": attempts,
        "processedAt": to_utc_naive(now),
        "error": build_lease_expired_message(lease),
    }
    async with get_db_connection() as conn:
        async with conn.transaction():
            requeued = (await conn.execute(build_requeue_expired_sql(), params)).rowcount or 0
            failed = (await conn.execute(build_fail_expired_sql(), params)).rowcount or 0
    if requeued or failed:
        logger.warning("Expired DomainEvent leases: %d re-queued, %d failed (max attempts reached)", requeued, failed)
    return {"requeued": requeued, "failed": failed}


async def dispatch_event(event: dict) -> tuple[str, Optional[str]]:
    """Run the registered handler for an event; returns (final status, error text)."""
    handler = get_handler(event.get("type", ""))
    error: Optional[BaseException] = None
    try:
        await handler(event)
    except Exception as exc:  # handler failures must not kill the poller
        error = exc
        logger.exception("DomainEvent %s (%s) handler failed", event.get("id"), event.get("type"))
    return decide_final_status(error), format_error(error)


async def process_batch(limit: Optional[int] = None) -> dict:
    """Claim, dispatch and finalize one batch. Returns counters."""
    batch_size = limit if limit is not None else settings.POLL_BATCH_SIZE
    events = await claim_pending_events(batch_size)
    counts = {"claimed": len(events), STATUS_DONE: 0, STATUS_FAILED: 0, "leaseLost": 0}
    for event in events:
        status, error = await dispatch_event(event)
        try:
            owned = await finalize_event(event["id"], status, event["lockedAt"], error)
        except Exception:
            logger.exception("Failed to finalize DomainEvent %s as %s", event["id"], status)
            continue
        if not owned:
            logger.warning("Lease lost for DomainEvent %s; result %s discarded", event["id"], status)
            counts["leaseLost"] += 1
            continue
        counts[status] += 1
    return counts


async def _wait_or_stop(stop_event: asyncio.Event, seconds: float) -> None:
    try:
        await asyncio.wait_for(stop_event.wait(), timeout=seconds)
    except asyncio.TimeoutError:
        pass


async def run_poller_loop(
    stop_event: asyncio.Event,
    interval_seconds: Optional[float] = None,
    batch_size: Optional[int] = None,
    sweep_seconds: Optional[float] = None,
) -> None:
    """Poll until `stop_event` is set. A full batch triggers an immediate re-poll.

    Expired leases are swept on start and then every `sweep_seconds`.
    """
    interval = interval_seconds if interval_seconds is not None else settings.POLL_INTERVAL_SECONDS
    size = batch_size if batch_size is not None else settings.POLL_BATCH_SIZE
    sweep = sweep_seconds if sweep_seconds is not None else settings.EVENT_LEASE_SWEEP_SECONDS
    logger.info("DomainEvent poller started (interval=%ss, batch=%s, lease sweep=%ss)", interval, size, sweep)
    last_sweep: Optional[float] = None
    while not stop_event.is_set():
        if last_sweep is None or time.monotonic() - last_sweep >= sweep:
            try:
                await recover_expired_leases()
            except Exception:
                logger.exception("DomainEvent lease recovery failed")
            last_sweep = time.monotonic()
        try:
            counts = await process_batch(size)
        except Exception:
            logger.exception("DomainEvent poll iteration failed")
            counts = {"claimed": 0}
        if counts["claimed"] < size:
            await _wait_or_stop(stop_event, interval)
    logger.info("DomainEvent poller stopped")
