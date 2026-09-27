"""Developer load-verification tool for the DomainEvent outbox poller.

NOT a test: not under `agent/tests/`, not collected by pytest, and does not
import from it. Exercises the real `process_batch` claim/dispatch/finalize
path (`FOR UPDATE SKIP LOCKED`) against whatever database `DATABASE_URL`
resolves to (repo-root `.env` by default — see `src/config.py`).

Usage (from `C:\\Pulse\\agent`, with the project venv):

    agent\\.venv\\Scripts\\python.exe -m scripts.load_outbox --events 500 --consumers 3

What it does:
  1. Inserts `--events` `LOAD_TEST_NOOP` DomainEvents tagged with a unique
     run id (so concurrent/leftover data never gets confused with this run).
  2. Registers a handler for that type that increments a per-event-id
     in-memory counter (with a small random sleep to simulate real work and
     interleave consumers).
  3. Runs `--consumers` concurrent workers, each looping `process_batch`
     until no `LOAD_TEST_NOOP` row from this run is PENDING/PROCESSING.
  4. Asserts: every event was processed exactly once (by *our* handler), all
     rows ended DONE, zero FAILED, and zero deadlock errors were observed.
  5. Prints a summary (duration, per-consumer claim counts) and deletes its
     own rows in a `finally` block regardless of outcome.

Caveat — foreign consumers: if a live `pulse-agent` process is polling the
same database, it may claim some of this run's events through its own
in-process `default_handler` (unknown event types are logged and marked
DONE) before our consumers get to them. Those rows end up DONE without ever
touching *our* counter, which would otherwise look like silent data loss.
This script tells the two apart (`foreign claims` in the summary) instead of
silently passing. Stop `pulse-agent` first (`docker stop pulse-agent`) for a
clean signal.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
import time
import uuid
from collections import Counter
from datetime import timedelta
from typing import Optional

from src.clock import get_now
from src.db import generate_id, get_db_connection, to_json, to_utc_naive
from src.poller import (
    STATUS_DONE,
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_PROCESSING,
    clear_handlers,
    process_batch,
    register_handler,
    unregister_handler,
)

EVENT_TYPE = "LOAD_TEST_NOOP"
DEFAULT_EVENTS = 500
DEFAULT_CONSUMERS = 3
DEFAULT_BATCH_SIZE = 20


# --------------------------------------------------------------------- #
# DB helpers (scoped to this script; poller.py's public API is untouched)
# --------------------------------------------------------------------- #
def build_insert_sql() -> str:
    return (
        'INSERT INTO "DomainEvent" ("id", "type", "payload", "status", "attempts", "createdAt") '
        "VALUES (%(id)s, %(type)s, %(payload)s, %(status)s, 0, %(createdAt)s)"
    )


def build_run_tag_filter() -> str:
    """Reused WHERE fragment: rows belonging to this script's run."""
    return '"type" = %(type)s AND "payload"->>\'runTag\' = %(runTag)s'


async def seed_events(count: int, run_tag: str) -> list[str]:
    """Insert `count` LOAD_TEST_NOOP rows tagged with `run_tag`. Returns their ids."""
    ids: list[str] = []
    base_now = to_utc_naive(get_now())
    async with get_db_connection() as conn:
        async with conn.transaction():
            for i in range(count):
                event_id = generate_id()
                ids.append(event_id)
                await conn.execute(
                    build_insert_sql(),
                    {
                        "id": event_id,
                        "type": EVENT_TYPE,
                        "payload": to_json({"runTag": run_tag, "seq": i}),
                        "status": STATUS_PENDING,
                        # Explicit createdAt (spread by 1ms/row) so ORDER BY createdAt ASC
                        # in the real claim query has a deterministic, non-degenerate order.
                        "createdAt": base_now + timedelta(milliseconds=i),
                    },
                )
    return ids


async def count_remaining(run_tag: str) -> int:
    async with get_db_connection() as conn:
        cur = await conn.execute(
            f'SELECT COUNT(*) AS n FROM "DomainEvent" WHERE {build_run_tag_filter()} '
            'AND "status" IN (%(pending)s, %(processing)s)',
            {"type": EVENT_TYPE, "runTag": run_tag, "pending": STATUS_PENDING, "processing": STATUS_PROCESSING},
        )
        row = await cur.fetchone()
        return int(row["n"])


async def fetch_run_rows(run_tag: str) -> list[dict]:
    async with get_db_connection() as conn:
        cur = await conn.execute(
            f'SELECT "id", "status", "error", "attempts" FROM "DomainEvent" WHERE {build_run_tag_filter()}',
            {"type": EVENT_TYPE, "runTag": run_tag},
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def delete_run_rows(run_tag: str) -> int:
    async with get_db_connection() as conn:
        cur = await conn.execute(
            f'DELETE FROM "DomainEvent" WHERE {build_run_tag_filter()}',
            {"type": EVENT_TYPE, "runTag": run_tag},
        )
        return cur.rowcount or 0


# --------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------- #
async def run_load_test(events: int, consumers: int, batch_size: int) -> int:
    run_tag = f"load-{int(time.time())}-{uuid.uuid4().hex[:10]}"
    processed: dict[str, int] = {}
    processed_lock = asyncio.Lock()
    claim_counts = [0 for _ in range(consumers)]
    deadlock_count = [0]

    async def handler(event: dict) -> None:
        payload = event.get("payload") or {}
        if payload.get("runTag") != run_tag:
            # Not this run's row (stale leftovers, or type collision) — leave uncounted.
            return
        await asyncio.sleep(random.uniform(0, 0.005))  # simulate 0-5ms of real handler work
        async with processed_lock:
            processed[event["id"]] = processed.get(event["id"], 0) + 1

    clear_handlers()
    register_handler(EVENT_TYPE, handler)

    ids: list[str] = []
    exit_code = 1
    try:
        print(f"[load_outbox] seeding {events} {EVENT_TYPE} events (runTag={run_tag}) ...")
        seed_started = time.monotonic()
        ids = await seed_events(events, run_tag)
        print(f"[load_outbox] seeded {len(ids)} events in {time.monotonic() - seed_started:.2f}s")

        async def is_drained() -> bool:
            return await count_remaining(run_tag) == 0

        async def consumer(index: int) -> None:
            while True:
                try:
                    counts = await process_batch(batch_size)
                except Exception as exc:  # pragma: no cover - diagnostic path only
                    if "deadlock" in str(exc).lower():
                        deadlock_count[0] += 1
                    print(f"[load_outbox] consumer-{index} batch error: {exc!r}")
                    counts = {"claimed": 0}
                claim_counts[index] += counts.get("claimed", 0)
                if counts.get("claimed", 0) == 0:
                    if await is_drained():
                        return
                    await asyncio.sleep(0.02 + random.random() * 0.03)

        drain_started = time.monotonic()
        await asyncio.gather(*(consumer(i) for i in range(consumers)))
        drain_duration = time.monotonic() - drain_started
        total_duration = time.monotonic() - seed_started

        rows = await fetch_run_rows(run_tag)
        by_status = Counter(r["status"] for r in rows)
        row_ids = {r["id"] for r in rows}
        row_status_by_id = {r["id"]: r["status"] for r in rows}
        missing_rows = sorted(set(ids) - row_ids)
        duplicated = {eid: n for eid, n in processed.items() if n != 1}
        never_processed_by_us = sorted(set(ids) - set(processed.keys()))
        foreign_claims = sorted(eid for eid in never_processed_by_us if row_status_by_id.get(eid) == STATUS_DONE)

        print("\n[load_outbox] ==== summary ====")
        print(f"events requested         : {events}")
        print(f"events seeded             : {len(ids)}")
        print(f"seed+drain duration       : {total_duration:.2f}s (drain: {drain_duration:.2f}s)")
        for i, c in enumerate(claim_counts):
            print(f"consumer-{i} claimed       : {c}")
        print(f"status breakdown          : {dict(by_status)}")
        print(f"processed by our handler  : {len(processed) - len(duplicated)} exactly-once "
              f"(+{len(duplicated)} duplicated) of {len(ids)} expected")
        print(f"deadlock errors observed  : {deadlock_count[0]}")
        print(f"foreign claims (other pulse-agent process) : {len(foreign_claims)}")

        ok = True
        if missing_rows:
            print(f"[load_outbox] FAIL: {len(missing_rows)} seeded row(s) vanished: {missing_rows[:5]}")
            ok = False
        if by_status.get(STATUS_FAILED, 0):
            print(f"[load_outbox] FAIL: {by_status[STATUS_FAILED]} event(s) ended FAILED")
            for r in rows:
                if r["status"] == STATUS_FAILED:
                    print(f"           -> {r['id']}: {r['error']}")
            ok = False
        if by_status.get(STATUS_PENDING, 0) or by_status.get(STATUS_PROCESSING, 0):
            print("[load_outbox] FAIL: some events never reached a terminal state (PENDING/PROCESSING remain)")
            ok = False
        if by_status.get(STATUS_DONE, 0) != len(ids):
            print(f"[load_outbox] FAIL: expected {len(ids)} DONE rows, found {by_status.get(STATUS_DONE, 0)}")
            ok = False
        if duplicated:
            sample = list(duplicated.items())[:5]
            print(f"[load_outbox] FAIL: {len(duplicated)} event(s) processed more than once by our handler: {sample}")
            ok = False
        if deadlock_count[0]:
            print(f"[load_outbox] FAIL: {deadlock_count[0]} deadlock error(s) observed")
            ok = False
        if foreign_claims:
            print(
                f"[load_outbox] WARN: {len(foreign_claims)} event(s) were finalized DONE but never seen by our "
                "handler — a live pulse-agent process on the same database claimed them via its own "
                "default_handler before our consumers could. This is expected if pulse-agent is running "
                "concurrently; stop it (`docker stop pulse-agent`) and re-run for a clean signal."
            )
            ok = False
        else:
            unexplained = sorted(set(never_processed_by_us) - set(foreign_claims))
            if unexplained:
                print(f"[load_outbox] FAIL: {len(unexplained)} event(s) never processed by anyone: {unexplained[:5]}")
                ok = False

        if ok:
            print("[load_outbox] PASS: every event processed exactly once, all DONE, zero FAILED, zero deadlocks")
        exit_code = 0 if ok else 1
    finally:
        deleted = await delete_run_rows(run_tag)
        print(f"[load_outbox] cleanup: deleted {deleted} row(s) for runTag={run_tag}")
        unregister_handler(EVENT_TYPE)

    return exit_code


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--events", type=int, default=DEFAULT_EVENTS, help=f"number of DomainEvents to seed (default {DEFAULT_EVENTS})")
    parser.add_argument("--consumers", type=int, default=DEFAULT_CONSUMERS, help=f"number of concurrent consumers (default {DEFAULT_CONSUMERS})")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help=f"process_batch limit per claim (default {DEFAULT_BATCH_SIZE})")
    return parser.parse_args(argv)


def main() -> int:
    if sys.platform == "win32":
        # psycopg async requires a selector loop on Windows (Proactor is unsupported).
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    args = parse_args()
    return asyncio.run(run_load_test(args.events, args.consumers, args.batch_size))


if __name__ == "__main__":
    sys.exit(main())
