"""pulse-agent entry point: `python -m src.main`.

Startup sequence (spec 6.01 §4.8):
  1. Verify database connectivity (retry until reachable or shutdown requested).
  2. Run the startup catch-up.
  3. Start APScheduler (daily SCHEDULE_HOUR:00 Europe/Istanbul).
  4. Start the DomainEvent outbox poller loop (sweeps expired leases on start
     and every EVENT_LEASE_SWEEP_SECONDS).
  5. Wait for SIGINT / SIGTERM, then shut down gracefully.
"""

from __future__ import annotations

import asyncio
import logging
import signal
import sys

from src.agents import close_builtin_agents, register_builtin_agents
from src.catchup import run_startup_catchup
from src.clock import sync_clock_from_db
from src.config import DEFAULT_INTERNAL_API_SECRET, settings
from src.db import check_connection
from src.poller import run_poller_loop
from src.replay import close_replay
from src.scheduler import create_scheduler

logger = logging.getLogger("agent.main")

DB_RETRY_SECONDS = 5


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def install_signal_handlers(loop: asyncio.AbstractEventLoop, stop_event: asyncio.Event) -> None:
    """Set `stop_event` on SIGINT/SIGTERM.

    `loop.add_signal_handler` is unavailable on Windows (NotImplementedError), so fall
    back to `signal.signal` and hop back onto the loop thread-safely.
    """
    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is None:
            continue
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except (NotImplementedError, RuntimeError):
            try:
                signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stop_event.set))
            except (ValueError, OSError):  # not main thread / unsupported signal
                logger.debug("Could not install handler for %s", sig_name)


async def wait_for_database(stop_event: asyncio.Event) -> bool:
    while not stop_event.is_set():
        if await check_connection():
            return True
        logger.warning("Database not reachable; retrying in %ss", DB_RETRY_SECONDS)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=DB_RETRY_SECONDS)
        except asyncio.TimeoutError:
            pass
    return False


async def main() -> None:
    configure_logging()
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()
    install_signal_handlers(loop, stop_event)

    logger.info(
        "pulse-agent starting (TZ=%s, schedule=%02d:00, internal_api=%s)",
        settings.TZ,
        settings.SCHEDULE_HOUR,
        settings.INTERNAL_API_URL,
    )
    if settings.INTERNAL_API_SECRET == DEFAULT_INTERNAL_API_SECRET:
        logger.warning(
            "INTERNAL_API_SECRET uses the public default; set a unique value outside local development "
            "(production Next.js rejects the default)"
        )
    register_builtin_agents()

    if not await wait_for_database(stop_event):
        logger.info("Shutdown requested before database became available")
        return

    try:
        await sync_clock_from_db()
    except Exception:
        logger.exception("Initial clock sync failed")

    try:
        await run_startup_catchup()
    except Exception:
        logger.exception("Startup catch-up failed")

    scheduler = create_scheduler()
    scheduler.start()
    poller_task = asyncio.create_task(run_poller_loop(stop_event), name="domain-event-poller")
    logger.info("pulse-agent running")

    try:
        await stop_event.wait()
    finally:
        logger.info("pulse-agent shutting down")
        stop_event.set()
        scheduler.shutdown(wait=False)
        try:
            await asyncio.wait_for(poller_task, timeout=30)
        except asyncio.TimeoutError:
            poller_task.cancel()
        try:
            await close_replay()
        except Exception:
            logger.exception("Failed to close in-flight Slot Replay tasks")
        try:
            await close_builtin_agents()
        except Exception:
            logger.exception("Failed to close builtin agents (Agent-003 checkpointer)")
        logger.info("pulse-agent stopped")


def run() -> None:
    if sys.platform == "win32":
        # psycopg async requires a selector loop on Windows (Proactor is unsupported).
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run()
