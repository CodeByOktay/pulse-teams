from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import pytz

from src.clock import (
    DEFAULT_TZ,
    get_mock_clock,
    get_now,
    is_mocked,
    reset_mock_clock,
    set_mock_clock,
    sync_clock_from_api,
    sync_clock_from_db,
)
from src.internal_client import InternalClient


@pytest.fixture(autouse=True)
def clean_clock():
    reset_mock_clock()
    yield
    reset_mock_clock()


def test_is_mocked_and_get_mock_clock():
    assert not is_mocked()
    assert get_mock_clock() is None

    pinned = datetime(2026, 10, 1, 9, 0, tzinfo=DEFAULT_TZ)
    set_mock_clock(pinned)
    assert is_mocked()
    assert get_mock_clock() == pinned
    assert get_now() == pinned

    reset_mock_clock()
    assert not is_mocked()
    assert get_mock_clock() is None


@pytest.mark.asyncio
async def test_sync_clock_from_db_when_mock_time_present():
    fake_time = datetime(2026, 11, 15, 14, 30, tzinfo=DEFAULT_TZ)

    mock_cur = AsyncMock()
    mock_cur.fetchone.return_value = {"mockTime": fake_time}
    mock_conn = AsyncMock()
    mock_conn.execute.return_value = mock_cur

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__.return_value = mock_conn
    mock_ctx.__aexit__.return_value = None

    with patch("src.db.get_db_connection", return_value=mock_ctx):
        res = await sync_clock_from_db()
        assert res is not None
        assert is_mocked()
        assert get_now().year == 2026
        assert get_now().month == 11
        assert get_now().day == 15


@pytest.mark.asyncio
async def test_sync_clock_from_db_when_mock_time_null():
    set_mock_clock(datetime(2026, 1, 1, tzinfo=DEFAULT_TZ))
    assert is_mocked()

    mock_cur = AsyncMock()
    mock_cur.fetchone.return_value = {"mockTime": None}
    mock_conn = AsyncMock()
    mock_conn.execute.return_value = mock_cur

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__.return_value = mock_conn
    mock_ctx.__aexit__.return_value = None

    with patch("src.db.get_db_connection", return_value=mock_ctx):
        res = await sync_clock_from_db()
        assert res is None
        assert not is_mocked()


@pytest.mark.asyncio
async def test_sync_clock_from_db_resilience_on_error():
    with patch("src.db.get_db_connection", side_effect=RuntimeError("DB offline")):
        res = await sync_clock_from_db()
        assert res is None
        assert not is_mocked()


@pytest.mark.asyncio
async def test_sync_clock_from_api_flow():
    client = MagicMock()
    client.get_clock = AsyncMock(return_value={
        "isMocked": True,
        "now": "2026-10-25T10:00:00Z",
        "mockTime": "2026-10-25T10:00:00Z",
    })

    res = await sync_clock_from_api(client)
    assert res is not None
    assert is_mocked()
    assert get_now().year == 2026
    assert get_now().month == 10
    assert get_now().day == 25

    client.get_clock = AsyncMock(return_value={
        "isMocked": False,
        "now": "2026-09-27T12:00:00Z",
        "mockTime": None,
    })

    res2 = await sync_clock_from_api(client)
    assert res2 is None
    assert not is_mocked()


@pytest.mark.asyncio
async def test_internal_client_clock_methods():
    client = InternalClient(base_url="http://test-pulse", secret="test-secret")
    client._request = AsyncMock()
    client._post_json = AsyncMock()

    mock_resp = MagicMock()
    mock_resp.is_success = True
    mock_resp.json.return_value = {"isMocked": False, "now": "2026-09-27T00:00:00Z", "mockTime": None}
    client._request.return_value = mock_resp

    clock_info = await client.get_clock()
    assert clock_info["isMocked"] is False

    target_dt = datetime(2026, 12, 1, 9, 0, tzinfo=DEFAULT_TZ)
    client._post_json.return_value = {"isMocked": True, "now": target_dt.isoformat(), "mockTime": target_dt.isoformat()}
    set_res = await client.set_clock(target_dt)
    assert set_res["isMocked"] is True
