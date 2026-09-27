from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
import pytz

logger = logging.getLogger("agent.clock")

_mock_now: Optional[datetime] = None
DEFAULT_TZ = pytz.timezone("Europe/Istanbul")


def get_now() -> datetime:
    global _mock_now
    if _mock_now is not None:
        return _mock_now
    return datetime.now(DEFAULT_TZ)


def is_mocked() -> bool:
    return _mock_now is not None


def get_mock_clock() -> Optional[datetime]:
    return _mock_now


def set_mock_clock(dt: datetime | None):
    global _mock_now
    if dt is not None and dt.tzinfo is None:
        # Interpret naive datetime as Istanbul local time
        _mock_now = DEFAULT_TZ.localize(dt)
    else:
        _mock_now = dt


def reset_mock_clock():
    global _mock_now
    _mock_now = None


async def sync_clock_from_db(conninfo: Optional[str] = None) -> Optional[datetime]:
    """Synchronizes in-memory clock with PostgreSQL SystemClock table.

    Safe against missing table or database connectivity issues.
    """
    try:
        from src.db import get_db_connection

        async with get_db_connection(conninfo) as conn:
            cur = await conn.execute('SELECT "mockTime" FROM "SystemClock" WHERE id = %s', ("current",))
            row = await cur.fetchone()
            if row and row.get("mockTime"):
                raw = row["mockTime"]
                if isinstance(raw, datetime):
                    if raw.tzinfo is None:
                        localized = pytz.utc.localize(raw).astimezone(DEFAULT_TZ)
                    else:
                        localized = raw.astimezone(DEFAULT_TZ)
                    set_mock_clock(localized)
                elif isinstance(raw, str):
                    parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                    if parsed.tzinfo is None:
                        localized = pytz.utc.localize(parsed).astimezone(DEFAULT_TZ)
                    else:
                        localized = parsed.astimezone(DEFAULT_TZ)
                    set_mock_clock(localized)
                return _mock_now
            else:
                reset_mock_clock()
                return None
    except Exception as exc:
        logger.debug("Clock sync from database skipped or failed: %s", exc)
        return _mock_now


async def sync_clock_from_api(internal_client) -> Optional[datetime]:
    """Synchronizes in-memory clock with Next.js Internal API."""
    try:
        data = await internal_client.get_clock()
        if data.get("isMocked") and data.get("mockTime"):
            raw = data["mockTime"]
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                localized = pytz.utc.localize(parsed).astimezone(DEFAULT_TZ)
            else:
                localized = parsed.astimezone(DEFAULT_TZ)
            set_mock_clock(localized)
            return _mock_now
        else:
            reset_mock_clock()
            return None
    except Exception as exc:
        logger.debug("Clock sync from internal API skipped or failed: %s", exc)
        return _mock_now
