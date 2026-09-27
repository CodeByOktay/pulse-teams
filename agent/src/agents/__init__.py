"""Concrete agents (Agent-001 .. Agent-009).

Extension point: each agent lives in its own module (e.g. `agent_001.py`) and is
wired into the supervisor inside `register_builtin_agents()` below, e.g.

    from src.agents.agent_001 import DeadlineTrackerAgent
    agent = DeadlineTrackerAgent(InternalClient())
    register_agent("agent-001", agent.run_for_project)

The registered callable must match `supervisor.AgentCallable`:
    async (project_id: str, scheduled_for: datetime) -> dict | None
Step 6.01 ships no concrete agents; the supervisor/scheduler run as no-ops.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("agent.agents")


def register_builtin_agents() -> list[str]:
    """Register all built-in agents with the supervisor. Returns registered keys."""
    from src import supervisor  # local import avoids import cycles for agent modules

    # Step 6.02+: register_agent("agent-001", ...), etc.
    keys = supervisor.get_registered_agent_keys()
    logger.info("Registered agents: %s", keys or "none")
    return keys
