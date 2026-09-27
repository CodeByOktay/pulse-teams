from datetime import datetime
import pytest
from src.agents.agent_001 import DeadlineTrackerAgent, DeadlineCheckFailed, AGENT_KEY
from src.agents import register_builtin_agents
from src import supervisor

class FakeInternalClient:
    def __init__(self, check_result=None, record_ok=True):
        self.check_result = check_result if check_result is not None else {"tasksScanned": 5, "remindersSent": 2, "escalationsSent": 1}
        self.record_ok = record_ok
        self.checked_projects = []
        self.recorded_runs = []

    async def trigger_deadline_check(self, project_id: str) -> dict:
        self.checked_projects.append(project_id)
        return self.check_result

    async def record_run(self, run_data: dict) -> bool:
        self.recorded_runs.append(run_data)
        return self.record_ok

@pytest.mark.asyncio
async def test_agent_001_run_success():
    client = FakeInternalClient(check_result={"tasksScanned": 10, "remindersSent": 3, "escalationsSent": 1})
    agent = DeadlineTrackerAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-abc", scheduled)

    assert result["tasksScanned"] == 10
    assert result["remindersSent"] == 3
    assert result["escalationsSent"] == 1
    assert result["tokenCount"] == 0

    assert client.checked_projects == ["prj-abc"]
    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "SUCCESS"
    assert client.recorded_runs[0]["tokenCount"] == 0

@pytest.mark.asyncio
async def test_agent_001_run_failure_raises_and_records_failed():
    # Empty dict simulates internal API failure
    client = FakeInternalClient(check_result={})
    agent = DeadlineTrackerAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    with pytest.raises(DeadlineCheckFailed):
        await agent.run_for_project("prj-failed", scheduled)

    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["status"] == "FAILED"

def test_agent_001_registration():
    supervisor.clear_agents()
    registered = register_builtin_agents()

    assert AGENT_KEY in registered
    assert supervisor.get_agent(AGENT_KEY) is not None
