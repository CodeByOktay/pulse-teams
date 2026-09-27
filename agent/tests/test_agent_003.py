"""Antigravity tests for Agent-003 (Status Requester with LangGraph Interrupt/Resume)."""

from datetime import datetime
import pytest
from langgraph.checkpoint.memory import MemorySaver
from src.agents.agent_003 import (
    StatusRequesterAgent,
    StatusRequestDispatchFailed,
    AGENT_KEY,
    build_graph,
)
from src.agents import register_builtin_agents, PROGRESS_QUICK_RESPONSE_EVENT
from src import supervisor, poller


class FakeStatusRequesterInternalClient:
    def __init__(self, dispatch_result=None, submit_result=None, record_ok=True):
        self.dispatch_result = (
            dispatch_result
            if dispatch_result is not None
            else {
                "tasksScanned": 5,
                "requestsOpened": 1,
                "requestsExpired": 0,
                "openedRequests": [
                    {
                        "requestId": "req-101",
                        "taskId": "task-abc",
                        "recipientId": "user-dev",
                    }
                ],
            }
        )
        self.submit_result = (
            submit_result
            if submit_result is not None
            else {"ok": True, "action": "COMPLETED", "proposalCreated": True}
        )
        self.record_ok = record_ok
        self.dispatched_projects = []
        self.recorded_runs = []
        self.submitted_responses = []

    async def trigger_status_requests(self, project_id: str) -> dict:
        self.dispatched_projects.append(project_id)
        return self.dispatch_result

    async def submit_status_response(self, request_id: str, action: str) -> dict:
        self.submitted_responses.append({"requestId": request_id, "action": action})
        return self.submit_result

    async def record_run(self, run_data: dict) -> bool:
        self.recorded_runs.append(run_data)
        return self.record_ok


@pytest.mark.asyncio
async def test_agent_003_graph_interrupt_and_resume():
    """Verifies that the compiled LangGraph interrupts with context and resumes with user action."""
    checkpointer = MemorySaver()
    graph = build_graph(checkpointer)

    thread_id = "test-thread-001"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "task_id": "task-xyz",
        "project_id": "prj-123",
        "recipient_id": "user-456",
        "request_id": "req-789",
        "status": "PENDING",
        "action_taken": None,
    }

    # First invoke: hits interrupt() and parks
    parked = await graph.ainvoke(initial_state, config=config)
    assert "__interrupt__" in parked
    interrupt_info = parked["__interrupt__"][0].value
    assert interrupt_info["request_id"] == "req-789"
    assert interrupt_info["task_id"] == "task-xyz"
    assert interrupt_info["recipient_id"] == "user-456"

    # Second invoke: resumes with Command(resume="COMPLETED")
    from langgraph.types import Command
    resumed = await graph.ainvoke(Command(resume="COMPLETED"), config=config)
    assert resumed["action_taken"] == "COMPLETED"
    assert resumed["status"] == "RESUMED"


@pytest.mark.asyncio
async def test_agent_003_run_success():
    client = FakeStatusRequesterInternalClient()
    checkpointer = MemorySaver()
    agent = StatusRequesterAgent(client, checkpointer=checkpointer)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-status-1", scheduled)

    assert result["tasksScanned"] == 5
    assert result["requestsOpened"] == 1
    assert result["threadsStarted"] == 1
    assert result["tokenCount"] == 0

    assert client.dispatched_projects == ["prj-status-1"]
    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "SUCCESS"
    assert client.recorded_runs[0]["tokenCount"] == 0


@pytest.mark.asyncio
async def test_agent_003_resume_request():
    client = FakeStatusRequesterInternalClient()
    checkpointer = MemorySaver()
    agent = StatusRequesterAgent(client, checkpointer=checkpointer)

    # Start thread
    await agent._start_thread(
        "prj-status-1",
        {"requestId": "req-202", "taskId": "task-99", "recipientId": "user-88"},
    )

    # Resume thread with quick action
    response = await agent.resume_request("req-202", "BLOCKED")
    assert response["action"] == "COMPLETED" or response.get("ok") is True
    assert len(client.submitted_responses) == 1
    assert client.submitted_responses[0] == {"requestId": "req-202", "action": "BLOCKED"}


@pytest.mark.asyncio
async def test_agent_003_run_failure_raises_and_records_failed():
    client = FakeStatusRequesterInternalClient(dispatch_result={})
    agent = StatusRequesterAgent(client, checkpointer=MemorySaver())

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    with pytest.raises(StatusRequestDispatchFailed):
        await agent.run_for_project("prj-status-fail", scheduled)

    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "FAILED"


def test_agent_003_registration_and_poller_handler():
    supervisor.clear_agents()
    poller.clear_handlers()

    registered = register_builtin_agents()

    assert AGENT_KEY in registered
    assert supervisor.get_agent(AGENT_KEY) is not None
    assert poller.get_handler(PROGRESS_QUICK_RESPONSE_EVENT) is not poller.default_handler
