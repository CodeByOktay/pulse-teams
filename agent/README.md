# pulse-agent

Python container for Pulse Phase 6 AI agent coordination (ADR-034, spec `docs/spec/v0.6.0-step-6.01.md` §4).

- **Agent-000 Supervisor** (`src/supervisor.py`): agent registry, per-project enablement (`AgentSettings.enabled`), one run per `(agentKey, projectId, scheduledFor)` via the `AgentRun` unique constraint, error capture.
- **Scheduler** (`src/scheduler.py`): APScheduler cron, daily at `SCHEDULE_HOUR:00` in `TZ`.
- **Startup catch-up** (`src/catchup.py`): runs today's missed slot once on boot.
- **Outbox poller** (`src/poller.py`): consumes `DomainEvent` rows with `FOR UPDATE SKIP LOCKED`. Each claim takes a lease (`lockedAt`, `attempts`); expired leases are re-queued or failed, and `lockedAt` fences finalization, so several agent instances can run safely. Handler errors are stored in `DomainEvent.error` and are not retried automatically.
- **Internal API client** (`src/internal_client.py`): HMAC-SHA256 signed calls to Next.js `/api/internal/agent/*`.
- **Clock** (`src/clock.py`): `get_now()` with `set_mock_clock()` for tests.

Python writes only `DomainEvent` status, `AgentRun` and `AgentProposal` rows; all other mutations go through the Next.js Internal API.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/pulse` | Prisma-only params such as `?schema=public` are stripped automatically |
| `INTERNAL_API_URL` | `http://localhost:3000` | `http://app:3000` inside docker-compose |
| `INTERNAL_API_SECRET` | `pulse-internal-secret-key-change-in-prod` | Must match the Next.js app |
| `TZ` | `Europe/Istanbul` | |
| `SCHEDULE_HOUR` | `9` | Daily run hour (local `TZ`) |
| `POLL_INTERVAL_SECONDS` | `5` | Outbox poll interval |
| `POLL_BATCH_SIZE` | `20` | Events claimed per poll |
| `EVENT_LEASE_SECONDS` | `600` | A PROCESSING event older than this lease is treated as abandoned |
| `EVENT_MAX_ATTEMPTS` | `3` | Claims allowed before an abandoned event is marked FAILED instead of re-queued |
| `EVENT_LEASE_SWEEP_SECONDS` | `60` | How often the poller sweeps for expired leases |
| `DB_CONNECT_TIMEOUT_SECONDS` | `10` | psycopg connect timeout |
| `LOG_LEVEL` | `INFO` | |

Values are read from the process environment, then `agent/.env`, then the repo root `.env`.

## Run locally

```bash
cd agent
python -m venv .venv
.venv/Scripts/activate        # Windows (source .venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
python -m src.main
```

## Tests

```bash
cd agent && pytest
```

Test suites under `agent/tests/` are authored by Antigravity (see ADR-034 §I).

## Docker

```bash
docker compose up -d --build agent   # service "agent", container "pulse-agent"
docker logs -f pulse-agent
```
