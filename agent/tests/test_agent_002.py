"""Antigravity tests for Agent-002 (Task Hygiene)."""

from datetime import datetime
import pytest
from src.agents.agent_002 import TaskHygieneAgent, HygieneCheckFailed, AGENT_KEY
from src.agents import register_builtin_agents
from src import supervisor


class FakeHygieneInternalClient:
    def __init__(self, check_result=None, record_ok=True):
        self.check_result = (
            check_result
            if check_result is not None
            else {"tasksScanned": 8, "defectiveTasks": 3, "reportSent": True}
        )
        self.record_ok = record_ok
        self.checked_projects = []
        self.recorded_runs = []

    async def trigger_hygiene_check(self, project_id: str) -> dict:
        self.checked_projects.append(project_id)
        return self.check_result

    async def record_run(self, run_data: dict) -> bool:
        self.recorded_runs.append(run_data)
        return self.record_ok


@pytest.mark.asyncio
async def test_agent_002_run_success():
    client = FakeHygieneInternalClient(
        check_result={"tasksScanned": 12, "defectiveTasks": 2, "reportSent": True}
    )
    agent = TaskHygieneAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-hygiene-1", scheduled)

    assert result["tasksScanned"] == 12
    assert result["defectiveTasks"] == 2
    assert result["reportSent"] is True
    assert result["tokenCount"] == 0

    assert client.checked_projects == ["prj-hygiene-1"]
    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "SUCCESS"
    assert client.recorded_runs[0]["tokenCount"] == 0
    assert client.recorded_runs[0]["projectId"] == "prj-hygiene-1"


@pytest.mark.asyncio
async def test_agent_002_run_failure_raises_and_records_failed():
    client = FakeHygieneInternalClient(check_result={})
    agent = TaskHygieneAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    with pytest.raises(HygieneCheckFailed):
        await agent.run_for_project("prj-hygiene-fail", scheduled)

    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "FAILED"
    assert client.recorded_runs[0]["projectId"] == "prj-hygiene-fail"


def test_agent_002_registration():
    supervisor.clear_agents()
    registered = register_builtin_agents()

    assert AGENT_KEY in registered
    assert supervisor.get_agent(AGENT_KEY) is not None
