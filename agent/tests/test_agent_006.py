"""Antigravity tests for Agent-006 (Weekly Sprint Digest)."""

from datetime import datetime
import pytz
import pytest

from src.agents.agent_006 import (
    WeeklyDigestAgent,
    WeeklyDigestFailed,
    run_weekly_digest,
    AGENT_KEY,
    WEEKLY_DIGEST_HOUR,
    WEEKLY_DIGEST_MINUTE,
)
from src.agents.agent_005 import compute_phase_time
from src import supervisor


class FakeWeeklyDigestInternalClient:
    def __init__(self, digest_result=None):
        self.digest_result = (
            digest_result
            if digest_result is not None
            else {"sent": True, "healthStatus": "ON_TRACK"}
        )
        self.digested_projects = []

    async def trigger_weekly_digest(self, project_id: str) -> dict:
        self.digested_projects.append(project_id)
        return self.digest_result


class SupervisorMock:
    def __init__(self, can_claim=True):
        self.can_claim = can_claim
        self.claimed = []
        self.completed = []

    async def claim_run(self, agent_key, project_id, scheduled_for, status="RUNNING"):
        if not self.can_claim:
            return None
        run_id = f"run-{agent_key}-{project_id}-{scheduled_for.strftime('%Y%m%d%H%M')}"
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


def test_agent_006_scheduled_time_computation():
    tz = pytz.timezone("Europe/Istanbul")
    friday = datetime(2026, 10, 16, 10, 0, 0, tzinfo=tz)

    scheduled = compute_phase_time(friday, WEEKLY_DIGEST_HOUR, WEEKLY_DIGEST_MINUTE, tz)
    assert scheduled.hour == 17
    assert scheduled.minute == 0
    assert scheduled.second == 0
    assert scheduled.day == 16


@pytest.mark.asyncio
async def test_agent_006_run_success(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeWeeklyDigestInternalClient()
    agent = WeeklyDigestAgent(client)

    scheduled = datetime(2026, 10, 16, 17, 0, 0)
    status = await agent.run_for_project("prj-digest-1", scheduled)

    assert status == "SUCCESS"
    assert client.digested_projects == ["prj-digest-1"]
    assert len(sup_mock.claimed) == 1
    assert sup_mock.claimed[0]["agent_key"] == AGENT_KEY
    assert len(sup_mock.completed) == 1
    assert sup_mock.completed[0]["status"] == "SUCCESS"
    assert sup_mock.completed[0]["result"] == {"sent": True, "healthStatus": "ON_TRACK"}


@pytest.mark.asyncio
async def test_agent_006_run_duplicate_skips(monkeypatch):
    sup_mock = SupervisorMock(can_claim=False)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeWeeklyDigestInternalClient()
    agent = WeeklyDigestAgent(client)

    scheduled = datetime(2026, 10, 16, 17, 0, 0)
    status = await agent.run_for_project("prj-dup", scheduled)

    assert status == "DUPLICATE"
    assert len(client.digested_projects) == 0
    assert len(sup_mock.completed) == 0


@pytest.mark.asyncio
async def test_agent_006_run_failure_empty_result(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeWeeklyDigestInternalClient(digest_result={})
    agent = WeeklyDigestAgent(client)

    scheduled = datetime(2026, 10, 16, 17, 0, 0)
    status = await agent.run_for_project("prj-empty", scheduled)

    assert status == "FAILED"
    assert len(sup_mock.completed) == 1
    assert sup_mock.completed[0]["status"] == "FAILED"
    assert "WeeklyDigestFailed" in sup_mock.completed[0]["error"]


@pytest.mark.asyncio
async def test_agent_006_run_failure_exception(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    client = FakeWeeklyDigestInternalClient()

    async def raise_error(project_id: str):
        raise TimeoutError("Internal API timed out")

    client.trigger_weekly_digest = raise_error
    agent = WeeklyDigestAgent(client)

    scheduled = datetime(2026, 10, 16, 17, 0, 0)
    status = await agent.run_for_project("prj-timeout", scheduled)

    assert status == "FAILED"
    assert len(sup_mock.completed) == 1
    assert sup_mock.completed[0]["status"] == "FAILED"
    assert "TimeoutError" in sup_mock.completed[0]["error"]


@pytest.mark.asyncio
async def test_run_weekly_digest_scheduler_entry_point(monkeypatch):
    sup_mock = SupervisorMock(can_claim=True)
    monkeypatch.setattr(supervisor, "claim_run", sup_mock.claim_run)
    monkeypatch.setattr(supervisor, "complete_run", sup_mock.complete_run)

    settings_rows = [
        {"projectId": "prj-1", "agentKey": AGENT_KEY, "enabled": True},
        {"projectId": "prj-2", "agentKey": AGENT_KEY, "enabled": True},
        {"projectId": "prj-3", "agentKey": "agent-001", "enabled": True},
    ]

    async def mock_load_settings(enabled_only=True):
        return settings_rows

    monkeypatch.setattr(supervisor, "load_agent_settings", mock_load_settings)

    client = FakeWeeklyDigestInternalClient()
    now = datetime(2026, 10, 16, 17, 0, 0, tzinfo=pytz.timezone("Europe/Istanbul"))

    counts = await run_weekly_digest(client, now=now)

    assert counts == {"SUCCESS": 2}
    assert client.digested_projects == ["prj-1", "prj-2"]


def test_agent_006_intentionally_not_in_supervisor_registry():
    """Agent-006 runs weekly (Friday 17:00), so it must NOT be in the daily 09:00 supervisor registry."""
    assert AGENT_KEY not in supervisor.get_registered_agent_keys()
    assert supervisor.get_agent(AGENT_KEY) is None
