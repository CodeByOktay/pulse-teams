"""Tests for Slot Replay engine, timeout bounding, and health heartbeat (Step 6.08, ADR-036)."""

from datetime import datetime, timedelta
import pytz
import pytest

from src.clock import get_now, get_now_override, now_override, DEFAULT_TZ
from src.config import get_effective_handler_timeout
from src.health import write_heartbeat, is_heartbeat_fresh
from src.internal_client import InternalClient
from src.replay import ReplayJobType, ReplaySlot, plan_missed_slots


def make_dt(year, month, day, hour, minute=0, second=0):
    return DEFAULT_TZ.localize(datetime(year, month, day, hour, minute, second))


def test_plan_missed_slots_backward_or_same_returns_empty():
    now = make_dt(2026, 9, 28, 10, 0, 0)
    # same instant
    assert plan_missed_slots(now, now) == []
    # backward clock travel
    past = now - timedelta(hours=1)
    assert plan_missed_slots(now, past) == []


def test_plan_missed_slots_same_day_across_daily_cron():
    prev = make_dt(2026, 9, 28, 8, 0, 0)  # Monday 08:00
    curr = make_dt(2026, 9, 28, 10, 0, 0)  # Monday 10:00

    slots = plan_missed_slots(prev, curr, schedule_hour=9)
    # 09:00 is DAILY, 09:30 is STANDUP_OPEN
    assert len(slots) == 2
    assert slots[0].job == ReplayJobType.DAILY
    assert slots[0].fire_at == make_dt(2026, 9, 28, 9, 0, 0)
    assert slots[1].job == ReplayJobType.STANDUP_OPEN
    assert slots[1].fire_at == make_dt(2026, 9, 28, 9, 30, 0)


def test_plan_missed_slots_standup_phases_and_weekly_digest_friday():
    # 2026-10-02 is a Friday
    friday_morning = make_dt(2026, 10, 2, 9, 0, 0)
    friday_evening = make_dt(2026, 10, 2, 18, 0, 0)

    slots = plan_missed_slots(friday_morning, friday_evening, schedule_hour=9)
    # 09:00 is prev (exclusive, half-open interval (prev, curr])
    # Included: 09:30 STANDUP_OPEN, 11:30 STANDUP_CUTOFF, 17:00 WEEKLY_DIGEST
    jobs = [s.job for s in slots]
    assert jobs == [
        ReplayJobType.STANDUP_OPEN,
        ReplayJobType.STANDUP_CUTOFF,
        ReplayJobType.WEEKLY_DIGEST,
    ]


def test_plan_missed_slots_no_weekly_digest_on_thursday():
    # 2026-10-01 is a Thursday
    thu_morning = make_dt(2026, 10, 1, 9, 0, 0)
    thu_evening = make_dt(2026, 10, 1, 18, 0, 0)

    slots = plan_missed_slots(thu_morning, thu_evening, schedule_hour=9)
    jobs = [s.job for s in slots]
    assert jobs == [
        ReplayJobType.STANDUP_OPEN,
        ReplayJobType.STANDUP_CUTOFF,
    ]
    assert ReplayJobType.WEEKLY_DIGEST not in jobs


def test_plan_missed_slots_clamps_to_max_days():
    # Jump of 30 days
    prev = make_dt(2026, 9, 1, 0, 0, 0)
    curr = make_dt(2026, 10, 1, 12, 0, 0)

    slots = plan_missed_slots(prev, curr, max_days=14)
    oldest_slot = slots[0]
    # Oldest slot must not be older than curr - 14 days
    clamp_limit = curr - timedelta(days=14)
    assert oldest_slot.fire_at >= clamp_limit


def test_now_override_context_manager():
    fixed = make_dt(2026, 11, 1, 12, 0, 0)
    nested = make_dt(2026, 11, 2, 15, 0, 0)

    assert get_now_override() is None

    with now_override(fixed):
        assert get_now_override() == fixed
        assert get_now() == fixed

        with now_override(nested):
            assert get_now_override() == nested
            assert get_now() == nested

        # Restores outer override
        assert get_now_override() == fixed
        assert get_now() == fixed

    # Restores default None
    assert get_now_override() is None


def test_internal_client_with_as_of():
    fixed = make_dt(2026, 11, 1, 12, 0, 0)
    payload = {"projectId": "prj-1", "action": "test"}

    # Without override, payload is unchanged
    assert InternalClient._with_as_of(payload) == payload

    # With override, asOf is injected
    with now_override(fixed):
        stamped = InternalClient._with_as_of(payload)
        assert stamped["projectId"] == "prj-1"
        assert stamped["action"] == "test"
        assert stamped["asOf"] == fixed.isoformat()

    # Non-dict payloads are untouched
    assert InternalClient._with_as_of("plain-string") == "plain-string"
    assert InternalClient._with_as_of(123) == 123


def test_effective_handler_timeout_bounds():
    # Normal case: timeout is within lease margin
    assert get_effective_handler_timeout(120, 600) == 120

    # Lease margin restricts timeout: min(120, 100 - 30) = 70
    assert get_effective_handler_timeout(120, 100) == 70

    # Enforces minimum 10 seconds even if lease margin is very small
    assert get_effective_handler_timeout(5, 20) == 10
    assert get_effective_handler_timeout(100, 35) == 10


def test_heartbeat_write_and_freshness(tmp_path):
    hb_file = str(tmp_path / "heartbeat.txt")

    # Empty path is no-op
    write_heartbeat("")
    assert not is_heartbeat_fresh("", 60)

    # Missing file is not fresh
    assert not is_heartbeat_fresh(hb_file, 60)

    # Write heartbeat
    ref_time = 1000000.0
    write_heartbeat(hb_file, now=ref_time)

    # Fresh within 60s
    assert is_heartbeat_fresh(hb_file, max_age_seconds=60, now=ref_time + 30)

    # Stale after 61s
    assert not is_heartbeat_fresh(hb_file, max_age_seconds=60, now=ref_time + 61)
