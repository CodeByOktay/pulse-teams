from datetime import datetime
import pytz

_mock_now = None
DEFAULT_TZ = pytz.timezone("Europe/Istanbul")

def get_now() -> datetime:
    global _mock_now
    if _mock_now is not None:
        return _mock_now
    return datetime.now(DEFAULT_TZ)

def set_mock_clock(dt: datetime | None):
    global _mock_now
    _mock_now = dt

def reset_mock_clock():
    global _mock_now
    _mock_now = None
