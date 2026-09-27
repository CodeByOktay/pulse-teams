from datetime import datetime, timezone
import pytz
from src.clock import get_now, set_mock_clock, reset_mock_clock, DEFAULT_TZ

def test_get_now_returns_current_time_with_timezone():
    now = get_now()
    assert now.tzinfo is not None
    assert str(now.tzinfo) == "Europe/Istanbul"

def test_set_mock_clock_pins_time():
    fixed = datetime(2026, 10, 15, 9, 0, 0, tzinfo=DEFAULT_TZ)
    set_mock_clock(fixed)
    assert get_now() == fixed

def test_reset_mock_clock_restores_live_time():
    fixed = datetime(2020, 1, 1, 0, 0, 0, tzinfo=DEFAULT_TZ)
    set_mock_clock(fixed)
    assert get_now().year == 2020

    reset_mock_clock()
    assert get_now().year >= 2026
