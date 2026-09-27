"""Antigravity tests for Agent-007 (Workload Balancer)."""

from datetime import datetime
import pytest
from src.agents.agent_007 import WorkloadBalancerAgent, WorkloadCheckFailed, AGENT_KEY
from src.agents import register_builtin_agents
from src import supervisor


class FakeWorkloadInternalClient:
    def __init__(self, check_result=None, record_ok=True):
        self.check_result = (
            check_result
            if check_result is not None
            else {"proposalCreated": True, "overloadedUserId": "u-1", "underutilizedUserId": "u-2", "taskId": "t-1"}
        )
        self.record_ok = record_ok
        self.checked_projects = []
        self.recorded_runs = []

    async def trigger_workload_check(self, project_id: str) -> dict:
        self.checked_projects.append(project_id)
        return self.check_result

    async def record_run(self, run_data: dict) -> bool:
        self.recorded_runs.append(run_data)
        return self.record_ok


@pytest.mark.asyncio
async def test_agent_007_run_success():
    client = FakeWorkloadInternalClient(
        check_result={"proposalCreated": True, "overloadedUserId": "u-1", "underutilizedUserId": "u-2", "taskId": "t-1"}
    )
    agent = WorkloadBalancerAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-workload-1", scheduled)

    assert result["proposalCreated"] is True
    assert result["overloadedUserId"] == "u-1"
    assert result["underutilizedUserId"] == "u-2"
    assert result["tokenCount"] == 0

    assert client.checked_projects == ["prj-workload-1"]
    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "SUCCESS"
    assert client.recorded_runs[0]["tokenCount"] == 0
    assert client.recorded_runs[0]["projectId"] == "prj-workload-1"


@pytest.mark.asyncio
async def test_agent_007_run_no_imbalance_still_succeeds():
    client = FakeWorkloadInternalClient(check_result={"proposalCreated": False})
    agent = WorkloadBalancerAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    result = await agent.run_for_project("prj-workload-2", scheduled)

    assert result["proposalCreated"] is False
    assert client.recorded_runs[0]["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_agent_007_run_failure_raises_and_records_failed():
    client = FakeWorkloadInternalClient(check_result={})
    agent = WorkloadBalancerAgent(client)

    scheduled = datetime(2026, 10, 10, 9, 0, 0)
    with pytest.raises(WorkloadCheckFailed):
        await agent.run_for_project("prj-workload-fail", scheduled)

    assert len(client.recorded_runs) == 1
    assert client.recorded_runs[0]["agentKey"] == AGENT_KEY
    assert client.recorded_runs[0]["status"] == "FAILED"
    assert client.recorded_runs[0]["projectId"] == "prj-workload-fail"


@pytest.mark.asyncio
async def test_agent_007_duplicate_claim_short_circuits_without_calling_client():
    """Mirrors the supervisor's rate-limit contract: `claim_run` returning None means
    the agent coroutine itself is never invoked (this is enforced in `supervisor.run_agent`,
    not in `WorkloadBalancerAgent` -- verified here via the same fake-supervisor pattern)."""
    client = FakeWorkloadInternalClient()
    agent = WorkloadBalancerAgent(client)

    supervisor.clear_agents()
    supervisor.register_agent(AGENT_KEY, agent.run_for_project)

    async def fake_claim_run(agent_key, project_id, scheduled_for, status=supervisor.RUN_RUNNING):
        return None

    original_claim_run = supervisor.claim_run
    supervisor.claim_run = fake_claim_run
    try:
        scheduled = datetime(2026, 10, 10, 9, 0, 0)
        status = await supervisor.run_agent(AGENT_KEY, "prj-workload-dup", scheduled)
    finally:
        supervisor.claim_run = original_claim_run
        supervisor.clear_agents()

    assert status == "DUPLICATE"
    assert client.checked_projects == []


def test_agent_007_registration():
    supervisor.clear_agents()
    registered = register_builtin_agents()

    assert AGENT_KEY in registered
    assert supervisor.get_agent(AGENT_KEY) is not None
