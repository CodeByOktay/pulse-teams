"""Antigravity tests for Agent-008 (Sprint Assistant)."""

from datetime import datetime
import pytest
from src.agents.agent_008 import SprintAssistantAgent, SprintOverflowCheckFailed, AGENT_KEY
from src.agents import register_builtin_agents
from src import supervisor


class FakeSprintAssistantInternalClient:
    def __init__(self, overflow_result=None, retro_result=None, record_ok=True):
        self.overflow_result = overflow_result if overflow_result is not None else {"warned": True}
        self.retro_result = retro_result if retro_result is not None else {"published": True}
        self.record_ok = record_ok
        self.overflow_checked_projects = []
        self.retro_calls = []
        self.recorded_runs = []

    async def trigger_sprint_overflow_check(self, project_id: str) -> dict:
        self.overflow_checked_projects.append(project_id)
        return self.overflow_result

    async def trigger_sprint_retro(self, project_id: str, sprint_id: str) -> dict:
        self.retro_calls.append((project_id, sprint_id))
        return self.retro_result

    async def record_run(self, run_data: dict) -> bool:
        self.recorded_runs.append(run_data)
        return self.record_ok


@pytest.mark.asyncio
async def test_agent_008_run_success():
    client = FakeSprintAssistantInternalClient(overflow_result={"warned": True})
    agent = SprintAssistantAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-sprint-1", scheduled)

    assert result["warned"] is True
    assert result["tokenCount"] == 0

    assert client.overflow_checked_projects == ["prj-sprint-1"]
    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "SUCCESS"
    assert client.recorded_runs[0]["tokenCount"] == 0
    assert client.recorded_runs[0]["projectId"] == "prj-sprint-1"


@pytest.mark.asyncio
async def test_agent_008_run_failure_raises_and_records_failed():
    client = FakeSprintAssistantInternalClient(overflow_result={})
    agent = SprintAssistantAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    with pytest.raises(SprintOverflowCheckFailed):
        await agent.run_for_project("prj-sprint-fail", scheduled)

    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "FAILED"
    assert client.recorded_runs[0]["projectId"] == "prj-sprint-fail"


@pytest.mark.asyncio
async def test_agent_008_event_handler_dispatches_when_payload_valid():
    client = FakeSprintAssistantInternalClient()
    agent = SprintAssistantAgent(client)

    await agent.handle_event(
        {"type": "SPRINT_COMPLETED", "payload": {"projectId": "prj-event-1", "sprintId": "sprint-1"}}
    )
    assert client.retro_calls == [("prj-event-1", "sprint-1")]


@pytest.mark.asyncio
async def test_agent_008_event_handler_skips_when_sprint_id_missing():
    client = FakeSprintAssistantInternalClient()
    agent = SprintAssistantAgent(client)

    await agent.handle_event({"type": "SPRINT_COMPLETED", "payload": {"projectId": "prj-event-2"}})
    assert client.retro_calls == []


@pytest.mark.asyncio
async def test_agent_008_event_handler_skips_when_project_id_missing():
    client = FakeSprintAssistantInternalClient()
    agent = SprintAssistantAgent(client)

    await agent.handle_event({"type": "SPRINT_COMPLETED", "payload": {"sprintId": "sprint-2"}})
    assert client.retro_calls == []


@pytest.mark.asyncio
async def test_agent_008_event_handler_never_raises_on_malformed_event():
    client = FakeSprintAssistantInternalClient()
    agent = SprintAssistantAgent(client)

    await agent.handle_event({"type": "SPRINT_COMPLETED", "payload": {}})
    await agent.handle_event({"type": "SPRINT_COMPLETED"})
    assert client.retro_calls == []


def test_agent_008_registration():
    supervisor.clear_agents()
    registered = register_builtin_agents()

    assert AGENT_KEY in registered
    assert supervisor.get_agent(AGENT_KEY) is not None
