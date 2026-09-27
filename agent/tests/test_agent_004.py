"""Antigravity tests for Agent-004 (Blocker Manager)."""

from datetime import datetime
import pytest
from src.agents.agent_004 import BlockerManagerAgent, BlockerCheckFailed, AGENT_KEY
from src.agents import register_builtin_agents
from src import supervisor


class FakeBlockerInternalClient:
    def __init__(self, check_result=None, record_ok=True):
        self.check_result = (
            check_result
            if check_result is not None
            else {"overdueCount": 1, "staleCount": 0, "unblockedCount": 1}
        )
        self.record_ok = record_ok
        self.checked_projects = []
        self.recorded_runs = []

    async def trigger_blocker_check(self, project_id: str) -> dict:
        self.checked_projects.append(project_id)
        return self.check_result

    async def record_run(self, run_data: dict) -> bool:
        self.recorded_runs.append(run_data)
        return self.record_ok


@pytest.mark.asyncio
async def test_agent_004_run_success():
    client = FakeBlockerInternalClient(
        check_result={"overdueCount": 2, "staleCount": 1, "unblockedCount": 0}
    )
    agent = BlockerManagerAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-blocker-1", scheduled)

    assert result["overdueCount"] == 2
    assert result["staleCount"] == 1
    assert result["tokenCount"] == 0

    assert client.checked_projects == ["prj-blocker-1"]
    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "SUCCESS"
    assert client.recorded_runs[0]["tokenCount"] == 0
    assert client.recorded_runs[0]["projectId"] == "prj-blocker-1"


@pytest.mark.asyncio
async def test_agent_004_run_failure_raises_and_records_failed():
    client = FakeBlockerInternalClient(check_result={})
    agent = BlockerManagerAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    with pytest.raises(BlockerCheckFailed):
        await agent.run_for_project("prj-blocker-fail", scheduled)

    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "FAILED"
    assert client.recorded_runs[0]["projectId"] == "prj-blocker-fail"


@pytest.mark.asyncio
async def test_agent_004_event_handler_dispatches_when_project_present():
    client = FakeBlockerInternalClient()
    agent = BlockerManagerAgent(client)

    await agent.handle_event({"type": "TASK_STATE_CHANGED", "payload": {"projectId": "prj-event-1"}})
    assert client.checked_projects == ["prj-event-1"]


def test_agent_004_registration():
    supervisor.clear_agents()
    registered = register_builtin_agents()

    assert AGENT_KEY in registered
    assert supervisor.get_agent(AGENT_KEY) is not None
