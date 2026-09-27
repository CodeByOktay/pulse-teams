"""HMAC-SHA256 signed HTTP client for the Next.js Internal API (`/api/internal/agent/*`).

Signature contract (mirrors `src/lib/internal-auth.ts` on the Next.js side):
    message   = f"{timestamp}.{body}"          # timestamp = epoch milliseconds (string)
    signature = hex(HMAC_SHA256(secret, message))
    headers   = x-agent-signature / x-agent-timestamp

Network / HTTP failures never raise: bool-returning calls return False and
dict-returning calls return {} after logging the problem.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Optional

import httpx

from src.config import settings

logger = logging.getLogger("agent.internal_client")

DEFAULT_TIMEOUT_SECONDS = 10.0


def sign_payload(secret: str, timestamp: str | int, body: str) -> str:
    """Pure HMAC-SHA256 signature over f"{timestamp}.{body}" (hex digest)."""
    message = f"{timestamp}.{body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def current_timestamp_ms() -> str:
    return str(int(time.time() * 1000))


def _dumps(payload: Any) -> str:
    return json.dumps(payload, default=str)


class InternalClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        secret: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self.base_url = (base_url if base_url is not None else settings.INTERNAL_API_URL).rstrip("/")
        self.secret = secret if secret is not None else settings.INTERNAL_API_SECRET
        self.timeout = timeout
        # Optional injectable transport (e.g. httpx.MockTransport) for tests.
        self._transport = transport

    # ------------------------------------------------------------------ #
    # Signing / transport helpers
    # ------------------------------------------------------------------ #
    def _generate_headers(self, body_str: str, timestamp: Optional[str] = None) -> dict:
        ts = timestamp if timestamp is not None else current_timestamp_ms()
        return {
            "Content-Type": "application/json",
            "x-agent-signature": sign_payload(self.secret, ts, body_str),
            "x-agent-timestamp": ts,
        }

    def _client(self) -> httpx.AsyncClient:
        kwargs: dict[str, Any] = {"timeout": self.timeout}
        if self._transport is not None:
            kwargs["transport"] = self._transport
        return httpx.AsyncClient(**kwargs)

    async def _request(
        self,
        method: str,
        path: str,
        body: str = "",
        params: Optional[dict] = None,
    ) -> Optional[httpx.Response]:
        """Send a signed request. Returns None on network errors (logged)."""
        headers = self._generate_headers(body)
        url = f"{self.base_url}{path}"
        try:
            async with self._client() as client:
                return await client.request(
                    method,
                    url,
                    content=body if body else None,
                    params=params,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            logger.error("Internal API %s %s failed: %r", method, path, exc)
            return None

    async def _post_bool(self, path: str, payload: Any) -> bool:
        resp = await self._request("POST", path, _dumps(payload))
        if resp is None:
            return False
        if not resp.is_success:
            logger.warning("Internal API POST %s returned %s: %s", path, resp.status_code, resp.text[:500])
            return False
        return True

    async def _post_json(self, path: str, payload: Any) -> dict:
        resp = await self._request("POST", path, _dumps(payload))
        return self._json_or_empty(resp, "POST", path)

    @staticmethod
    def _json_or_empty(resp: Optional[httpx.Response], method: str, path: str) -> dict:
        if resp is None:
            return {}
        if not resp.is_success:
            logger.warning("Internal API %s %s returned %s: %s", method, path, resp.status_code, resp.text[:500])
            return {}
        try:
            data = resp.json()
        except ValueError:
            logger.warning("Internal API %s %s returned non-JSON body", method, path)
            return {}
        return data if isinstance(data, dict) else {"data": data}

    # ------------------------------------------------------------------ #
    # Endpoints (Step 6.01)
    # ------------------------------------------------------------------ #
    async def send_notifications(self, notifications: list) -> bool:
        """POST /api/internal/agent/notifications"""
        return await self._post_bool("/api/internal/agent/notifications", {"notifications": notifications})

    async def get_project_settings(self, project_id: str) -> dict:
        """GET /api/internal/agent/settings?projectId=... (signed over empty body)."""
        path = "/api/internal/agent/settings"
        resp = await self._request("GET", path, "", params={"projectId": project_id})
        return self._json_or_empty(resp, "GET", path)

    async def record_run(self, run_data: dict) -> bool:
        """POST /api/internal/agent/runs"""
        return await self._post_bool("/api/internal/agent/runs", run_data)

    async def create_progress_request(
        self,
        project_id: str,
        task_id: str,
        recipient_id: str,
        custom_message: Optional[str] = None,
    ) -> bool:
        """POST /api/internal/agent/progress-requests"""
        payload: dict[str, Any] = {
            "projectId": project_id,
            "taskId": task_id,
            "recipientId": recipient_id,
        }
        if custom_message is not None:
            payload["customMessage"] = custom_message
        return await self._post_bool("/api/internal/agent/progress-requests", payload)

    # ------------------------------------------------------------------ #
    # Agent-specific endpoints (Step 6.02+): thin wrappers over `_post_json` / `_post_bool`.
    # ------------------------------------------------------------------ #
    async def trigger_deadline_check(self, project_id: str) -> dict:
        """POST /api/internal/agent/deadline-check -> DeadlineCheckResult ({} on failure)."""
        return await self._post_json("/api/internal/agent/deadline-check", {"projectId": project_id})

    async def trigger_hygiene_check(self, project_id: str) -> dict:
        """POST /api/internal/agent/hygiene-check -> HygieneCheckResult ({} on failure)."""
        return await self._post_json("/api/internal/agent/hygiene-check", {"projectId": project_id})

    async def trigger_status_requests(self, project_id: str) -> dict:
        """POST /api/internal/agent/status-requests -> StatusRequestDispatchResult
        (includes `openedRequests`, the newly-created ProgressRequests to start
        LangGraph threads for). {} on failure."""
        return await self._post_json("/api/internal/agent/status-requests", {"projectId": project_id})

    async def submit_status_response(self, request_id: str, action: str) -> dict:
        """POST /api/internal/agent/status-response -- reports a resumed Agent-003
        thread's human action so Next.js can perform the deterministic Tier B/C
        side effect (AgentProposal / ADMIN escalation). {} on failure."""
        return await self._post_json(
            "/api/internal/agent/status-response", {"requestId": request_id, "action": action}
        )

    # ------------------------------------------------------------------ #
    # Clock synchronization endpoints (Step 6.04 / ADR-034 Clock Abstraction)
    # ------------------------------------------------------------------ #
    async def get_clock(self) -> dict:
        """GET /api/internal/agent/clock -> { isMocked, now, mockTime }"""
        resp = await self._request("GET", "/api/internal/agent/clock", "")
        return self._json_or_empty(resp, "GET", "/api/internal/agent/clock")

    async def set_clock(self, mock_time: Optional[datetime]) -> dict:
        """POST /api/internal/agent/clock -> { isMocked, now, mockTime }"""
        payload = {"mockTime": mock_time.isoformat() if mock_time is not None else None}
        return await self._post_json("/api/internal/agent/clock", payload)
