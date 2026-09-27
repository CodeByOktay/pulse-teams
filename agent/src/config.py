"""Environment-driven settings for the pulse-agent container.

Environment variables are loaded via python-dotenv. Lookup order (first wins,
real process environment always takes precedence):
  1. process environment (docker-compose `environment:`)
  2. agent/.env
  3. <repo root>/.env (so local runs reuse the Next.js DATABASE_URL / secret)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv

_AGENT_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _AGENT_DIR.parent

load_dotenv(_AGENT_DIR / ".env", override=False)
load_dotenv(_REPO_ROOT / ".env", override=False)

DEFAULT_DATABASE_URL = "postgresql://postgres:password@localhost:5432/pulse"
DEFAULT_INTERNAL_API_URL = "http://localhost:3000"
DEFAULT_INTERNAL_API_SECRET = "pulse-internal-secret-key-change-in-prod"
DEFAULT_TZ = "Europe/Istanbul"

# Query params understood by Prisma but rejected by libpq/psycopg.
_PRISMA_ONLY_PARAMS = frozenset({"schema", "connection_limit", "pool_timeout", "pgbouncer"})


def build_conninfo(database_url: str) -> str:
    """Convert a Prisma-style DATABASE_URL into a psycopg-compatible conninfo.

    Prisma URLs may carry `?schema=public` (and other Prisma-only params) which
    libpq rejects as an invalid URI query parameter. Those are stripped; all
    other params (e.g. `sslmode`) are preserved.
    """
    url = (database_url or "").strip().strip('"').strip("'")
    if not url:
        return url
    parts = urlsplit(url)
    if not parts.query:
        return url
    kept = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in _PRISMA_ONLY_PARAMS]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass
class Settings:
    DATABASE_URL: str = field(default_factory=lambda: os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    INTERNAL_API_URL: str = field(default_factory=lambda: os.getenv("INTERNAL_API_URL", DEFAULT_INTERNAL_API_URL))
    INTERNAL_API_SECRET: str = field(
        default_factory=lambda: os.getenv("INTERNAL_API_SECRET", DEFAULT_INTERNAL_API_SECRET)
    )
    TZ: str = field(default_factory=lambda: os.getenv("TZ", DEFAULT_TZ) or DEFAULT_TZ)
    SCHEDULE_HOUR: int = field(default_factory=lambda: _int_env("SCHEDULE_HOUR", 9))
    POLL_INTERVAL_SECONDS: int = field(default_factory=lambda: _int_env("POLL_INTERVAL_SECONDS", 5))
    POLL_BATCH_SIZE: int = field(default_factory=lambda: _int_env("POLL_BATCH_SIZE", 20))
    # A PROCESSING event whose lease is older than this is considered abandoned.
    EVENT_LEASE_SECONDS: int = field(default_factory=lambda: _int_env("EVENT_LEASE_SECONDS", 600))
    # Claims allowed before an abandoned event is marked FAILED instead of re-queued.
    EVENT_MAX_ATTEMPTS: int = field(default_factory=lambda: _int_env("EVENT_MAX_ATTEMPTS", 3))
    # How often the poller loop sweeps for expired leases.
    EVENT_LEASE_SWEEP_SECONDS: int = field(default_factory=lambda: _int_env("EVENT_LEASE_SWEEP_SECONDS", 60))
    # Wall-clock ceiling for a single handler invocation (see `get_effective_handler_timeout`).
    EVENT_HANDLER_TIMEOUT_SECONDS: int = field(
        default_factory=lambda: _int_env("EVENT_HANDLER_TIMEOUT_SECONDS", 120)
    )
    DB_CONNECT_TIMEOUT_SECONDS: int = field(default_factory=lambda: _int_env("DB_CONNECT_TIMEOUT_SECONDS", 10))
    LOG_LEVEL: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    # Liveness heartbeat file for the Docker healthcheck (`python -m src.health`).
    # Empty string (default) disables heartbeat writing entirely.
    HEARTBEAT_FILE: str = field(default_factory=lambda: os.getenv("HEARTBEAT_FILE", ""))

    @property
    def conninfo(self) -> str:
        """psycopg-safe connection string derived from DATABASE_URL."""
        return build_conninfo(self.DATABASE_URL)


def get_effective_handler_timeout(timeout: int, lease: int) -> int:
    """Timeout değerini min(timeout, lease - 30) ile sınırlar (en az 10 sn)."""
    return max(10, min(timeout, lease - 30))


settings = Settings()
