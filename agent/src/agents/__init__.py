"""Concrete agents (Agent-001 .. Agent-009).

Extension point: each agent lives in its own module (e.g. `agent_001.py`) and is
wired into the supervisor inside `register_builtin_agents()` below, e.g.

    from src.agents.agent_001 import DeadlineTrackerAgent
    agent = DeadlineTrackerAgent(InternalClient())
    register_agent("agent-001", agent.run_for_project)

The registered callable must match `supervisor.AgentCallable`:
    async (project_id: str, scheduled_for: datetime) -> dict | None
Registered: agent-001 (Deadline Tracker, Step 6.02).
"""

from __future__ import annotations

import logging

logger = logging.getLogger("agent.agents")


def register_builtin_agents() -> list[str]:
    """Register all built-in agents with the supervisor. Returns registered keys."""
    from src import supervisor  # local import avoids import cycles for agent modules

    from src.agents.agent_001 import AGENT_KEY as AGENT_001_KEY, DeadlineTrackerAgent
    from src.internal_client import InternalClient

    client = InternalClient()
    supervisor.register_agent(AGENT_001_KEY, DeadlineTrackerAgent(client).run_for_project)

    keys = supervisor.get_registered_agent_keys()
    logger.info("Registered agents: %s", keys or "none")
    return keys
