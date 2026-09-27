"""Concrete agents (Agent-001 .. Agent-009).

Extension point: each agent lives in its own module (e.g. `agent_001.py`) and is
wired into the supervisor inside `register_builtin_agents()` below, e.g.

    from src.agents.agent_001 import DeadlineTrackerAgent
    agent = DeadlineTrackerAgent(InternalClient())
    register_agent("agent-001", agent.run_for_project)

The registered callable must match `supervisor.AgentCallable`:
    async (project_id: str, scheduled_for: datetime) -> dict | None
Registered: agent-001 (Deadline Tracker, Step 6.02), agent-002 (Task Hygiene,
Step 6.03), agent-003 (Status Requester, Step 6.03), agent-004 (Blocker
Manager, Step 6.04), agent-009 (Scope Creep Detection, Step 6.04).

Agent-004 and agent-009 are also wired into the DomainEvent poller (their
`handle_event` methods run outside the supervisor, fire-and-forget -- see each
module's docstring): TASK_STATE_CHANGED / TASK_RELATION_CREATED -> agent-004,
TASK_SPRINT_ADDED / TASK_CREATED -> agent-009.

`register_builtin_agents()` stays synchronous (it runs before the container has
confirmed DB connectivity in `main.py`) -- agent-003's Postgres checkpointer is
created lazily on its first real `ainvoke`, not at registration time. This
function also registers the poller handler that resumes a parked Agent-003
LangGraph thread when a `PROGRESS_QUICK_RESPONSE_SUBMITTED` DomainEvent arrives.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("agent.agents")

PROGRESS_QUICK_RESPONSE_EVENT = "PROGRESS_QUICK_RESPONSE_SUBMITTED"

# Kept so `close_builtin_agents()` can release Agent-003's checkpointer connection
# pool on graceful shutdown; `register_builtin_agents()` itself must stay sync.
_status_requester = None


def _make_quick_response_handler(status_requester):
    async def handle_progress_quick_response(event: dict) -> None:
        payload = event.get("payload") or {}
        request_id = payload.get("requestId")
        action = payload.get("action")
        if not request_id or not action:
            logger.warning(
                "%s event missing requestId/action: %s", PROGRESS_QUICK_RESPONSE_EVENT, payload
            )
            return
        await status_requester.resume_request(request_id, action)

    return handle_progress_quick_response


def register_builtin_agents() -> list[str]:
    """Register all built-in agents with the supervisor. Returns registered keys."""
    global _status_requester
    from src import poller, supervisor  # local imports avoid import cycles for agent modules

    from src.agents.agent_001 import AGENT_KEY as AGENT_001_KEY, DeadlineTrackerAgent
    from src.agents.agent_002 import AGENT_KEY as AGENT_002_KEY, TaskHygieneAgent
    from src.agents.agent_003 import AGENT_KEY as AGENT_003_KEY, StatusRequesterAgent
    from src.agents.agent_004 import AGENT_KEY as AGENT_004_KEY, BlockerManagerAgent
    from src.agents.agent_009 import AGENT_KEY as AGENT_009_KEY, ScopeCreepAgent
    from src.internal_client import InternalClient

    client = InternalClient()
    supervisor.register_agent(AGENT_001_KEY, DeadlineTrackerAgent(client).run_for_project)
    supervisor.register_agent(AGENT_002_KEY, TaskHygieneAgent(client).run_for_project)

    _status_requester = StatusRequesterAgent(client)
    supervisor.register_agent(AGENT_003_KEY, _status_requester.run_for_project)
    poller.register_handler(PROGRESS_QUICK_RESPONSE_EVENT, _make_quick_response_handler(_status_requester))

    blocker_manager = BlockerManagerAgent(client)
    supervisor.register_agent(AGENT_004_KEY, blocker_manager.run_for_project)
    poller.register_handler("TASK_STATE_CHANGED", blocker_manager.handle_event)
    poller.register_handler("TASK_RELATION_CREATED", blocker_manager.handle_event)

    scope_creep = ScopeCreepAgent(client)
    supervisor.register_agent(AGENT_009_KEY, scope_creep.run_for_project)
    poller.register_handler("TASK_SPRINT_ADDED", scope_creep.handle_event)
    poller.register_handler("TASK_CREATED", scope_creep.handle_event)

    keys = supervisor.get_registered_agent_keys()
    logger.info("Registered agents: %s", keys or "none")
    return keys


async def close_builtin_agents() -> None:
    """Releases Agent-003's checkpointer connection pool (graceful shutdown)."""
    global _status_requester
    if _status_requester is not None:
        await _status_requester.aclose()
        _status_requester = None
