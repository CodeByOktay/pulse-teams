from datetime import datetime
import pytz
from src.supervisor import (
    register_agent,
    unregister_agent,
    clear_agents,
    get_agent,
    get_registered_agent_keys,
    sort_agent_keys,
    compute_scheduled_for,
    should_run_catchup,
    is_agent_enabled,
    truncate_error,
    extract_token_count,
    MAX_ERROR_LENGTH,
)

def test_agent_registry():
    clear_agents()
    assert get_registered_agent_keys() == []

    async def dummy_agent(project_id: str, scheduled_for: datetime):
        return {"ok": True}

    register_agent("agent-001", dummy_agent)
    assert get_agent("agent-001") == dummy_agent
    assert "agent-001" in get_registered_agent_keys()

    unregister_agent("agent-001")
    assert get_agent("agent-001") is None
    clear_agents()

def test_sort_agent_keys_prioritizes_hygiene_then_deadline_then_status():
    # AGENT_PRIORITY: agent-002 (hygiene) -> agent-001 (deadline) -> agent-003 (status)
    keys = ["agent-003", "agent-001", "agent-002", "agent-custom"]
    sorted_keys = sort_agent_keys(keys)
    assert sorted_keys == ["agent-002", "agent-001", "agent-003", "agent-custom"]

def test_compute_scheduled_for():
    tz = pytz.timezone("Europe/Istanbul")
    now = datetime(2026, 9, 27, 14, 30, 0, tzinfo=tz)
    scheduled = compute_scheduled_for(now, hour=9, tz=tz)

    assert scheduled.hour == 9
    assert scheduled.minute == 0
    assert scheduled.second == 0
    assert scheduled.day == 27
    assert scheduled.month == 9
    assert scheduled.year == 2026

def test_should_run_catchup():
    tz = pytz.timezone("Europe/Istanbul")
    scheduled_0900 = datetime(2026, 9, 27, 9, 0, 0, tzinfo=tz)

    # 1. 08:30 (before scheduled time) -> should NOT catch up
    now_0830 = datetime(2026, 9, 27, 8, 30, 0, tzinfo=tz)
    assert should_run_catchup(now_0830, scheduled_0900, has_run=False) is False

    # 2. 14:00 (after scheduled time) and has NOT run -> SHOULD catch up
    now_1400 = datetime(2026, 9, 27, 14, 0, 0, tzinfo=tz)
    assert should_run_catchup(now_1400, scheduled_0900, has_run=False) is True

    # 3. 14:00 (after scheduled time) but ALREADY ran -> should NOT run again
    assert should_run_catchup(now_1400, scheduled_0900, has_run=True) is False

def test_is_agent_enabled():
    rows = [
        {"projectId": "p1", "agentKey": "agent-001", "enabled": True},
        {"projectId": "p1", "agentKey": "agent-002", "enabled": False},
    ]

    assert is_agent_enabled(rows, "p1", "agent-001") is True
    assert is_agent_enabled(rows, "p1", "agent-002") is False
    # Missing row defaults to disabled
    assert is_agent_enabled(rows, "p1", "agent-003") is False
    assert is_agent_enabled(rows, "p2", "agent-001") is False

def test_truncate_error():
    short_err = ValueError("Something bad")
    assert truncate_error(short_err) == "ValueError: Something bad"

    long_msg = "X" * 3000
    truncated = truncate_error(long_msg)
    assert len(truncated) == MAX_ERROR_LENGTH

def test_extract_token_count():
    assert extract_token_count({"tokenCount": 150}) == 150
    assert extract_token_count({"tokenCount": 0}) == 0
    assert extract_token_count({"tokenCount": -5}) == 0
    assert extract_token_count({"tokenCount": "invalid"}) == 0
    assert extract_token_count(None) == 0
    assert extract_token_count({}) == 0
