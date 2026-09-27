"""End-to-end multi-agent coordination, slot replay execution, and poller resilience tests (Step 6.08, ADR-036)."""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, patch
import pytest
import pytz

from src.clock import DEFAULT_TZ, now_override
from src.internal_client import InternalClient
from src.poller import (
    STATUS_FAILED,
    STATUS_DONE,
    build_release_sql,
    clear_handlers,
    dispatch_event,
    register_handler,
    release_events,
)
from src.replay import (
    ReplayJobType,
    ReplaySlot,
    close_replay,
    execute_replay,
    handle_clock_advanced,
)
from src.supervisor import _with_replay_marker


def make_dt(year, month, day, hour, minute=0, second=0):
    return DEFAULT_TZ.localize(datetime(year, month, day, hour, minute, second))


def test_supervisor_with_replay_marker_stamps_replayed_flag():
    # Outside replay override: returns result as-is
    res = {"status": "ok", "itemsProcessed": 5}
    assert _with_replay_marker(res) == res

    # Inside replay override: stamps replayed: True
    dt = make_dt(2026, 10, 1, 9, 0, 0)
    with now_override(dt):
        stamped = _with_replay_marker(res)
        assert stamped["replayed"] is True
        assert stamped["status"] == "ok"
        assert stamped["itemsProcessed"] == 5

        # With None result: returns dict with replayed: True
        stamped_none = _with_replay_marker(None)
        assert stamped_none == {"replayed": True}


@pytest.mark.asyncio
async def test_execute_replay_invokes_slots_and_accumulates_counters():
    slot_daily = ReplaySlot(fire_at=make_dt(2026, 10, 2, 9, 0, 0), job=ReplayJobType.DAILY)
    slot_standup = ReplaySlot(fire_at=make_dt(2026, 10, 2, 9, 30, 0), job=ReplayJobType.STANDUP_OPEN)
    slot_cutoff = ReplaySlot(fire_at=make_dt(2026, 10, 2, 11, 30, 0), job=ReplayJobType.STANDUP_CUTOFF)
    slot_digest = ReplaySlot(fire_at=make_dt(2026, 10, 2, 17, 0, 0), job=ReplayJobType.WEEKLY_DIGEST)

    client = InternalClient()

    with (
        patch("src.supervisor.run_daily_agents", new_callable=AsyncMock) as mock_daily,
        patch("src.replay.run_standup_phase", new_callable=AsyncMock) as mock_standup,
        patch("src.replay.run_weekly_digest", new_callable=AsyncMock) as mock_digest,
    ):
        counters = await execute_replay(
            [slot_daily, slot_standup, slot_cutoff, slot_digest],
            client,
        )

        assert mock_daily.await_count == 1
        assert mock_standup.await_count == 2
        assert mock_digest.await_count == 1

        assert counters == {
            "daily": 1,
            "standup-open": 1,
            "standup-cutoff": 1,
            "weekly-digest": 1,
        }


@pytest.mark.asyncio
async def test_execute_replay_slot_failure_isolated():
    slot_fail = ReplaySlot(fire_at=make_dt(2026, 10, 2, 9, 0, 0), job=ReplayJobType.DAILY)
    slot_ok = ReplaySlot(fire_at=make_dt(2026, 10, 2, 17, 0, 0), job=ReplayJobType.WEEKLY_DIGEST)

    client = InternalClient()

    with (
        patch("src.supervisor.run_daily_agents", new_callable=AsyncMock, side_effect=RuntimeError("DB timeout")),
        patch("src.replay.run_weekly_digest", new_callable=AsyncMock) as mock_digest,
    ):
        counters = await execute_replay([slot_fail, slot_ok], client)

        # The failure of daily does NOT stop weekly digest from executing
        assert mock_digest.await_count == 1
        assert counters == {
            "daily_failed": 1,
            "weekly-digest": 1,
        }


@pytest.mark.asyncio
async def test_handle_clock_advanced_schedules_replay_task():
    event = {
        "id": "evt-123",
        "type": "CLOCK_ADVANCED",
        "payload": {
            "previous": "2026-10-01T08:00:00+03:00",
            "current": "2026-10-01T10:00:00+03:00",
        },
    }

    with patch("src.replay._run_replay_serialized", new_callable=AsyncMock) as mock_run:
        await handle_clock_advanced(event)
        # Yield to let the created background task run
        await asyncio.sleep(0.01)
        assert mock_run.await_count == 1
        # Arguments passed to _run_replay_serialized: (slots, client)
        call_slots = mock_run.call_args[0][0]
        assert len(call_slots) == 2  # DAILY (09:00) and STANDUP_OPEN (09:30)

    # Invalid timestamp returns early without raising or launching tasks
    with patch("src.replay._run_replay_serialized", new_callable=AsyncMock) as mock_run_bad:
        await handle_clock_advanced({"payload": {"previous": "not-a-date", "current": "invalid"}})
        await asyncio.sleep(0.01)
        assert mock_run_bad.await_count == 0

    await close_replay(timeout=1.0)


@pytest.mark.asyncio
async def test_poller_dispatch_event_timeout_marks_failed():
    clear_handlers()

    async def slow_handler(_event: dict):
        await asyncio.sleep(0.2)

    register_handler("TEST_TIMEOUT_EVENT", slow_handler)

    event = {"id": "evt-timeout", "type": "TEST_TIMEOUT_EVENT"}
    status, error = await dispatch_event(event, timeout_seconds=0.03)

    assert status == STATUS_FAILED
    assert error is not None
    assert "timed out after" in error

    clear_handlers()


@pytest.mark.asyncio
async def test_poller_release_sql_and_empty_release():
    sql = build_release_sql()
    assert 'UPDATE "DomainEvent"' in sql
    assert '"status" = %(pending)s' in sql
    assert '"lockedAt" = NULL' in sql
    assert '"attempts" = GREATEST("attempts" - 1, 0)' in sql
    assert '"id" = ANY(%(ids)s)' in sql
    assert '"lockedAt" = %(lockedAt)s' in sql

    # Releasing empty list returns 0 immediately without hitting DB
    now = make_dt(2026, 10, 1, 9, 0, 0)
    released = await release_events([], now)
    assert released == 0
