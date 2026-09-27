"""Antigravity tests for Agent-009 (Scope Creep Detection)."""

from datetime import datetime
import pytest
from src.agents.agent_009 import ScopeCreepAgent, ScopeCreepCheckFailed, AGENT_KEY
from src.agents import register_builtin_agents
from src import supervisor


class FakeScopeCreepInternalClient:
    def __init__(self, check_result=None, record_ok=True):
        self.check_result = (
            check_result
            if check_result is not None
            else {"activeSprintCount": 1, "alertsSent": 1}
        )
        self.record_ok = record_ok
        self.checked_projects = []
        self.recorded_runs = []

    async def trigger_scope_creep_check(self, project_id: str) -> dict:
        self.checked_projects.append(project_id)
        return self.check_result

    async def record_run(self, run_data: dict) -> bool:
        self.recorded_runs.append(run_data)
        return self.record_ok


@pytest.mark.asyncio
async def test_agent_009_run_success():
    client = FakeScopeCreepInternalClient(
        check_result={"activeSprintCount": 1, "alertsSent": 1}
    )
    agent = ScopeCreepAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-scope-1", scheduled)

    assert result["activeSprintCount"] == 1
    assert result["alertsSent"] == 1
    assert result["tokenCount"] == 0

    assert client.checked_projects == ["prj-scope-1"]
    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "SUCCESS"
    assert client.recorded_runs[0]["tokenCount"] == 0
    assert client.recorded_runs[0]["projectId"] == "prj-scope-1"


@pytest.mark.asyncio
async def test_agent_009_run_failure_raises_and_records_failed():
    client = FakeScopeCreepInternalClient(check_result={})
    agent = ScopeCreepAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    with pytest.raises(ScopeCreepCheckFailed):
        await agent.run_for_project("prj-scope-fail", scheduled)

    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "FAILED"
    assert client.recorded_runs[0]["projectId"] == "prj-scope-fail"


@pytest.mark.asyncio
async def test_agent_009_event_handler_dispatches_when_project_present():
    client = FakeScopeCreepInternalClient()
    agent = ScopeCreepAgent(client)

    await agent.handle_event({"type": "TASK_SPRINT_ADDED", "payload": {"projectId": "prj-sprint-event"}})
    assert client.checked_projects == ["prj-sprint-event"]


def test_agent_009_registration():
    supervisor.clear_agents()
    registered = register_builtin_agents()

    assert AGENT_KEY in registered
    assert supervisor.get_agent(AGENT_KEY) is not None
