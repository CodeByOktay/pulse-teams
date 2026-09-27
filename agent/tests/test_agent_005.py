"""Antigravity tests for Agent-005 (Async Daily Standup)."""

from datetime import datetime
import pytz
import pytest

from src.agents.agent_005 import (
    DailyStandupAgent,
    StandupCheckFailed,
    compute_phase_time,
    run_standup_phase,
    AGENT_KEY,
    PHASE_OPEN,
    PHASE_CUTOFF,
    STANDUP_OPEN_HOUR,
    STANDUP_OPEN_MINUTE,
    STANDUP_CUTOFF_HOUR,
    STANDUP_CUTOFF_MINUTE,
)
from src import supervisor


class FakeStandupInternalClient:
    def __init__(self, open_result=None, synthesize_result=None):
        self.open_result = (
            open_result if open_result is not None else {"opened": True, "standupId": "su-101"}
        )
        self.synthesize_result = (
            synthesize_result if synthesize_result is not None else {"entryCount": 2, "published": True}
        )
        self.opened_projects = []
        self.synthesized_projects = []

    async def trigger_standup_open(self, project_id: str) -> dict:
        self.opened_projects.append(project_id)
        return self.open_result

    async def trigger_standup_synthesize(self, project_id: str) -> dict:
        self.synthesized_projects.append(project_id)
        return self.synthesize_result


class SupervisorMock:
    def __init__(self, can_claim=True):
        self.can_claim = can_claim
        self.claimed = []
        self.completed = []

    async def claim_run(self, agent_key, project_id, scheduled_for, status="RUNNING"):
        if not self.can_claim:
            return None
        run_id = f"run-{agent_key}-{project_id}-{scheduled_for.strftime('%H%M')}"
        self.claimed.append(
            {
                "run_id": run_id,
                "agent_key": agent_key,
                "project_id": project_id,
                "scheduled_for": scheduled_for,
            }
        )
        return run_id

    async def complete_run(self, run_id, status, result=None, error=None):
        self.completed.append(
            {"run_id": run_id, "status": status, "result": result, "error": error}
        )


def test_compute_phase_time():
    tz = pytz.timezone("Europe/Istanbul")
    now = datetime(2026, 10, 15, 14, 0, 0, tzinfo=tz)

    open_time = compute_phase_time(now, STANDUP_OPEN_HOUR, STANDUP_OPEN_MINUTE, tz)
    assert open_time.hour == 9
    assert open_time.minute == 30
    assert open_time.second == 0
    assert open_time.day == 15
    assert open_time.month == 10
    assert open_time.year == 2026

    cutoff_time = compute_phase_time(now, STANDUP_CUTOFF_HOUR, STANDUP_CUTOFF_MINUTE, tz)
    assert cutoff_time.hour == 11
    assert cutoff_time.minute == 30
    assert cutoff_time.second == 0


@pytest.mark.asyncio
async def test_agent_005_open_phase_success(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeStandupInternalClient()
    agent = DailyStandupAgent(client)

    scheduled = datetime(2026, 10, 15, 9, 30, 0)
    status = await agent.open_standup("prj-standup-1", scheduled)

    assert status == "SUCCESS"
    assert client.opened_projects == ["prj-standup-1"]
    assert len(sup_mock.claimed) == 1
    assert sup_mock.claimed[0]["agent_key"] == AGENT_KEY
    assert len(sup_mock.completed) == 1
    assert sup_mock.completed[0]["status"] == "SUCCESS"
    assert sup_mock.completed[0]["result"] == {"opened": True, "standupId": "su-101"}


@pytest.mark.asyncio
async def test_agent_005_cutoff_phase_success(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeStandupInternalClient()
    agent = DailyStandupAgent(client)

    scheduled = datetime(2026, 10, 15, 11, 30, 0)
    status = await agent.close_standup("prj-standup-2", scheduled)

    assert status == "SUCCESS"
    assert client.synthesized_projects == ["prj-standup-2"]
    assert len(sup_mock.claimed) == 1
    assert sup_mock.completed[0]["status"] == "SUCCESS"
    assert sup_mock.completed[0]["result"] == {"entryCount": 2, "published": True}


@pytest.mark.asyncio
async def test_agent_005_duplicate_skips_internal_api(monkeypatch):
    sup_mock = SupervisorMock(can_claim=False)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeStandupInternalClient()
    agent = DailyStandupAgent(client)

    scheduled = datetime(2026, 10, 15, 9, 30, 0)
    status = await agent.open_standup("prj-dup", scheduled)

    assert status == "DUPLICATE"
    assert len(client.opened_projects) == 0
    assert len(sup_mock.completed) == 0


@pytest.mark.asyncio
async def test_agent_005_open_phase_failure(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeStandupInternalClient(open_result={})
    agent = DailyStandupAgent(client)

    scheduled = datetime(2026, 10, 15, 9, 30, 0)
    status = await agent.open_standup("prj-fail", scheduled)

    assert status == "FAILED"
    assert len(sup_mock.completed) == 1
    assert sup_mock.completed[0]["status"] == "FAILED"
    assert "StandupCheckFailed" in sup_mock.completed[0]["error"]


@pytest.mark.asyncio
async def test_agent_005_cutoff_phase_exception(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeStandupInternalClient()

    async def raise_error(project_id: str):
        raise ConnectionResetError("Next.js internal API down")

    client.trigger_standup_synthesize = raise_error
    agent = DailyStandupAgent(client)

    scheduled = datetime(2026, 10, 15, 11, 30, 0)
    status = await agent.close_standup("prj-err", scheduled)

    assert status == "FAILED"
    assert len(sup_mock.completed) == 1
    assert sup_mock.completed[0]["status"] == "FAILED"
    assert "ConnectionResetError" in sup_mock.completed[0]["error"]


@pytest.mark.asyncio
async def test_run_standup_phase(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    settings_rows = [
        {"projectId": "prj-alpha", "agentKey": AGENT_KEY, "enabled": True},
        {"projectId": "prj-beta", "agentKey": AGENT_KEY, "enabled": True},
        {"projectId": "prj-gamma", "agentKey": "agent-001", "enabled": True},
    ]

    async def mock_load_settings(enabled_only=True):
        return settings_rows

    monkeypatch.setattr(supervisor, "load_agent_settings", mock_load_settings)

    client = FakeStandupInternalClient()
    now = datetime(2026, 10, 15, 9, 30, 0, tzinfo=pytz.timezone("Europe/Istanbul"))

    counts = await run_standup_phase(client, PHASE_OPEN, now=now)

    assert counts == {"SUCCESS": 2}
    assert client.opened_projects == ["prj-alpha", "prj-beta"]


def test_agent_005_intentionally_not_in_supervisor_registry():
    """Agent-005 runs on custom schedule (09:30 & 11:30), so it must NOT be in the 09:00 supervisor registry."""
    assert AGENT_KEY not in supervisor.get_registered_agent_keys()
    assert supervisor.get_agent(AGENT_KEY) is None
