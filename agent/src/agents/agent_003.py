"""Agent-003 — Status Requester (Step 6.03, ADR-034).

The only agent (000-003) that keeps state across a human wait: an `IN_PROGRESS`
task that has been stale for `staleDays` gets a `ProgressRequest` opened for its
first assignee, and a LangGraph thread (`thread_id` = the request id) is started
into a single node that immediately calls `interrupt()` — the Postgres
checkpointer persists the paused state, so the wait survives a container
restart. Days later, when the human picks one of the 3 quick-response buttons
in the UI, `respondToProgressRequestQuick` (Next.js) closes the `ProgressRequest`
and emits a `PROGRESS_QUICK_RESPONSE_SUBMITTED` DomainEvent; the poller handler
registered in `src/agents/__init__.py` calls `resume_request()`, which wakes the
parked node with `Command(resume=action)` and reports the Tier B/C outcome
(AgentProposal / escalation) through `POST /api/internal/agent/status-response`.

Zero LLM tokens: every branch is deterministic (see `status-response` route).
A second daily entry point, folded into the same Internal API round trip as
opening new requests (`dispatchStatusRequests`), expires `PENDING` requests
older than `RESPONSE_TIMEOUT_DAYS` (2 days) and escalates them to project
ADMINs — that half needs no graph thread at all (nothing is ever resumed).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional, TypedDict

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command, interrupt

from src.clock import get_now
from src.internal_client import InternalClient

logger = logging.getLogger("agent.003")

AGENT_KEY = "agent-003"


class StatusRequestDispatchFailed(RuntimeError):
    """Raised when the Internal API returns no result, so the supervisor records FAILED."""


class Agent003State(TypedDict):
    task_id: str
    project_id: str
    recipient_id: str
    request_id: str
    status: str
    action_taken: Optional[str]


def await_response_node(state: Agent003State) -> dict:
    """The graph's only node. `interrupt()` parks execution here (raises internally;
    LangGraph persists the checkpoint and unwinds the `ainvoke` call) until a caller
    resumes the same `thread_id` with `Command(resume=<action>)` — at which point
    `interrupt()` returns that action and the node completes normally.
    """
    action = interrupt(
        {
            "request_id": state["request_id"],
            "task_id": state["task_id"],
            "recipient_id": state["recipient_id"],
        }
    )
    return {"action_taken": action, "status": "RESUMED"}


def build_graph(checkpointer: AsyncPostgresSaver):
    graph = StateGraph(Agent003State)
    graph.add_node("await_response", await_response_node)
    graph.set_entry_point("await_response")
    graph.add_edge("await_response", END)
    return graph.compile(checkpointer=checkpointer)


class StatusRequesterAgent:
    """Wraps the compiled LangGraph graph + `InternalClient` calls.

    The checkpointer (and the graph it's compiled into) is created lazily on
    first use, not in `__init__`: registration (`register_builtin_agents`,
    called synchronously at startup, before the DB is confirmed reachable)
    must stay sync, while `checkpointer.setup()` needs an open connection.
    """

    def __init__(self, internal_client: InternalClient, checkpointer: Optional[AsyncPostgresSaver] = None):
        self.client = internal_client
        self._checkpointer = checkpointer
        self._graph = None
        self._checkpointer_cm = None

    async def _ensure_graph(self):
        if self._graph is not None:
            return self._graph
        if self._checkpointer is None:
            from src.config import settings

            self._checkpointer_cm = AsyncPostgresSaver.from_conn_string(settings.conninfo)
            self._checkpointer = await self._checkpointer_cm.__aenter__()
            await self._checkpointer.setup()
        self._graph = build_graph(self._checkpointer)
        return self._graph

    async def aclose(self) -> None:
        """Releases the checkpointer's connection pool (graceful shutdown)."""
        if self._checkpointer_cm is not None:
            await self._checkpointer_cm.__aexit__(None, None, None)
        self._checkpointer = None
        self._checkpointer_cm = None
        self._graph = None

    async def run_for_project(self, project_id: str, scheduled_for: datetime) -> dict:
        """Daily entry point (Agent-000 supervisor): opens new ProgressRequests --
        each one started into its own parked graph thread -- and expires stale ones.
        A single bad thread-start must never fail the whole project's run.
        """
        now = get_now()
        logger.info("Running %s for project %s at %s", AGENT_KEY, project_id, now.isoformat())

        result = await self.client.trigger_status_requests(project_id)

        if not result:
            await self.client.record_run(
                {
                    "agentKey": AGENT_KEY,
                    "projectId": project_id,
                    "scheduledFor": scheduled_for.isoformat(),
                    "status": "FAILED",
                    "result": {},
                    "tokenCount": 0,
                }
            )
            raise StatusRequestDispatchFailed(
                f"status-requests trigger returned no result for project {project_id}"
            )

        opened = result.get("openedRequests") or []
        threads_started = 0
        for item in opened:
            try:
                await self._start_thread(project_id, item)
                threads_started += 1
            except Exception:
                logger.exception(
                    "Failed to start Agent-003 graph thread for request %s", item.get("requestId")
                )

        run_result = {**result, "threadsStarted": threads_started, "tokenCount": 0}
        await self.client.record_run(
            {
                "agentKey": AGENT_KEY,
                "projectId": project_id,
                "scheduledFor": scheduled_for.isoformat(),
                "status": "SUCCESS",
                "result": run_result,
                "tokenCount": 0,
            }
        )
        logger.info("%s finished for project %s: %s", AGENT_KEY, project_id, run_result)
        return run_result

    async def _start_thread(self, project_id: str, opened_request: dict) -> None:
        """ainvoke's the graph fresh; the node calls interrupt() immediately, so this
        returns as soon as the checkpoint is parked -- no human input has arrived yet."""
        graph = await self._ensure_graph()
        request_id = opened_request["requestId"]
        state: Agent003State = {
            "task_id": opened_request["taskId"],
            "project_id": project_id,
            "recipient_id": opened_request["recipientId"],
            "request_id": request_id,
            "status": "PENDING",
            "action_taken": None,
        }
        config = {"configurable": {"thread_id": request_id}}
        await graph.ainvoke(state, config=config)

    async def resume_request(self, request_id: str, action: str) -> dict:
        """Resumes the parked thread with the human's quick-response action, then
        reports the outcome through the Internal API (Tier B/C proposal/escalation).
        Called by the DomainEvent handler for PROGRESS_QUICK_RESPONSE_SUBMITTED.
        """
        graph = await self._ensure_graph()
        config = {"configurable": {"thread_id": request_id}}
        await graph.ainvoke(Command(resume=action), config=config)

        result = await self.client.submit_status_response(request_id, action)
        if not result:
            logger.warning(
                "status-response call returned no result for request %s (action=%s)", request_id, action
            )
        return result
