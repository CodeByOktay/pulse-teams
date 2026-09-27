import json
import pytest
import httpx
from src.internal_client import sign_payload, InternalClient

def test_sign_payload_computes_sha256_hmac():
    secret = "my-secret-key"
    timestamp = "1700000000000"
    body = '{"hello":"world"}'

    signature = sign_payload(secret, timestamp, body)
    assert isinstance(signature, str)
    assert len(signature) == 64  # sha256 hex is 64 chars

    # Re-computing with same params gives same signature
    assert sign_payload(secret, timestamp, body) == signature

    # Different body gives different signature
    assert sign_payload(secret, timestamp, '{"other":"data"}') != signature

@pytest.mark.asyncio
async def test_send_notifications_success():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-agent-signature"] is not None
        assert request.headers["x-agent-timestamp"] is not None
        assert json.loads(request.content) == {"notifications": [{"userId": "u1"}]}
        return httpx.Response(200, json={"success": True})

    client = InternalClient(
        base_url="http://testserver",
        secret="test-secret",
        transport=httpx.MockTransport(handler),
    )

    result = await client.send_notifications([{"userId": "u1"}])
    assert result is True

@pytest.mark.asyncio
async def test_send_notifications_handles_server_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    client = InternalClient(
        base_url="http://testserver",
        secret="test-secret",
        transport=httpx.MockTransport(handler),
    )

    result = await client.send_notifications([{"userId": "u1"}])
    assert result is False

@pytest.mark.asyncio
async def test_get_project_settings_success():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["projectId"] == "prj-99"
        return httpx.Response(200, json={"projectId": "prj-99", "enabled": True})

    client = InternalClient(
        base_url="http://testserver",
        secret="test-secret",
        transport=httpx.MockTransport(handler),
    )

    data = await client.get_project_settings("prj-99")
    assert data == {"projectId": "prj-99", "enabled": True}

@pytest.mark.asyncio
async def test_get_project_settings_handles_401():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "Unauthorized"})

    client = InternalClient(
        base_url="http://testserver",
        secret="test-secret",
        transport=httpx.MockTransport(handler),
    )

    data = await client.get_project_settings("prj-99")
    assert data == {}

@pytest.mark.asyncio
async def test_record_run_success():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["agentKey"] == "agent-001"
        assert payload["status"] == "SUCCESS"
        return httpx.Response(200, json={"ok": True})

    client = InternalClient(
        base_url="http://testserver",
        secret="test-secret",
        transport=httpx.MockTransport(handler),
    )

    ok = await client.record_run({
        "agentKey": "agent-001",
        "projectId": "prj-1",
        "scheduledFor": "2026-09-27T09:00:00Z",
        "status": "SUCCESS",
    })
    assert ok is True

@pytest.mark.asyncio
async def test_create_progress_request_success():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["projectId"] == "prj-1"
        assert payload["taskId"] == "tsk-1"
        assert payload["recipientId"] == "usr-1"
        return httpx.Response(200, json={"id": "pr-1"})

    client = InternalClient(
        base_url="http://testserver",
        secret="test-secret",
        transport=httpx.MockTransport(handler),
    )

    ok = await client.create_progress_request("prj-1", "tsk-1", "usr-1", "Status please")
    assert ok is True
