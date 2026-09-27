"""Liveness heartbeat for the Docker healthcheck (`python -m src.health`).

`write_heartbeat` is called once per `run_poller_loop` iteration (best-effort,
never raises) so an external healthcheck can assert the poller is actually
looping without touching the database. Freshness is always evaluated against
wall-clock `time.time()`, never the simulated in-app clock (`src.clock`):
a Docker healthcheck must reflect the real world even while a time-travel
test has the application clock jumped forward or backward.

Writing is disabled by default (`Settings.HEARTBEAT_FILE == ""`); the
Dockerfile healthcheck entry point below has its own independent default
path so it still works if only `HEARTBEAT_MAX_AGE_SECONDS` is customized.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

# Side effect: loads agent/.env and <repo root>/.env so `python -m src.health`
# run standalone (e.g. from a Docker HEALTHCHECK) sees the same env as the
# main process.
import src.config  # noqa: F401

logger = logging.getLogger("agent.health")

DEFAULT_HEARTBEAT_FILE = "/tmp/pulse-agent-heartbeat"
DEFAULT_HEARTBEAT_MAX_AGE_SECONDS = 120


def write_heartbeat(path: str, now: Optional[float] = None) -> None:
    """Write the current wall-clock timestamp to `path`. Best-effort, never raises."""
    if not path:
        return
    ts = now if now is not None else time.time()
    try:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = Path(str(target) + ".tmp")
        tmp_path.write_text(repr(ts), encoding="utf-8")
        os.replace(tmp_path, target)
        os.utime(target, (ts, ts))
    except Exception:
        logger.debug("Failed to write heartbeat file %s", path, exc_info=True)


def is_heartbeat_fresh(path: str, max_age_seconds: float, now: Optional[float] = None) -> bool:
    """True if `path` exists and was last written within `max_age_seconds`."""
    if not path:
        return False
    try:
        mtime = Path(path).stat().st_mtime
    except OSError:
        return False
    reference = now if now is not None else time.time()
    return 0 <= (reference - mtime) <= max_age_seconds


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _main() -> int:
    path = os.getenv("HEARTBEAT_FILE") or DEFAULT_HEARTBEAT_FILE
    max_age = _env_float("HEARTBEAT_MAX_AGE_SECONDS", DEFAULT_HEARTBEAT_MAX_AGE_SECONDS)
    if is_heartbeat_fresh(path, max_age):
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(_main())
