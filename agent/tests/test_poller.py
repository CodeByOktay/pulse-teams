import pytest
from datetime import datetime
from src.poller import (
    register_handler,
    unregister_handler,
    clear_handlers,
    get_handler,
    default_handler,
    build_claim_select_sql,
    build_claim_params,
    build_mark_processing_sql,
    build_finalize_sql,
    build_requeue_expired_sql,
    build_fail_expired_sql,
    decide_final_status,
    format_error,
    compute_lease_cutoff,
    to_db_millis,
    STATUS_PENDING,
    STATUS_DONE,
    STATUS_FAILED,
)

def test_poller_handler_registry():
    clear_handlers()

    # Unknown event returns default_handler
    assert get_handler("UNKNOWN_EVENT") == default_handler

    async def custom_handler(event: dict):
        return True

    register_handler("TASK_CREATED", custom_handler)
    assert get_handler("TASK_CREATED") == custom_handler

    unregister_handler("TASK_CREATED")
    assert get_handler("TASK_CREATED") == default_handler
    clear_handlers()

def test_build_claim_select_sql_contains_for_update_skip_locked():
    sql = build_claim_select_sql()
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert '"DomainEvent"' in sql
    assert '"status" = %(status)s' in sql

def test_build_claim_params():
    params = build_claim_params(15)
    assert params["status"] == STATUS_PENDING
    assert params["limit"] == 15

    # Handles edge cases (zero/negative limit clamped to at least 1)
    params_zero = build_claim_params(0)
    assert params_zero["limit"] == 1

def test_build_mark_processing_sql():
    sql = build_mark_processing_sql()
    assert '"lockedAt" = %(lockedAt)s' in sql
    assert '"attempts" = "attempts" + 1' in sql
    assert '"id" = ANY(%(ids)s)' in sql

def test_build_finalize_sql_checks_locked_at_fencing():
    sql = build_finalize_sql()
    assert '"status" = %(status)s' in sql
    assert '"lockedAt" = %(lockedAt)s' in sql
    assert '"processedAt" = %(processedAt)s' in sql
    assert '"error" = %(error)s' in sql

def test_build_sweep_sql():
    requeue_sql = build_requeue_expired_sql()
    assert '"status" = %(pending)s' in requeue_sql
    assert '"attempts" < %(maxAttempts)s' in requeue_sql

    fail_sql = build_fail_expired_sql()
    assert '"status" = %(failed)s' in fail_sql
    assert '"attempts" >= %(maxAttempts)s' in fail_sql

def test_decide_final_status():
    assert decide_final_status(None) == STATUS_DONE
    assert decide_final_status(ValueError("boom")) == STATUS_FAILED

def test_format_error():
    assert format_error(None) is None
    assert format_error(ValueError("Invalid id")) == "ValueError: Invalid id"

    long_err = ValueError("A" * 3000)
    formatted = format_error(long_err)
    assert len(formatted) <= 2000
    assert formatted.endswith("...")

def test_compute_lease_cutoff():
    now = datetime(2026, 9, 27, 12, 0, 0)
    cutoff = compute_lease_cutoff(now, 600)  # 10 minutes
    assert (now - cutoff).total_seconds() == 600

def test_to_db_millis():
    # Microseconds truncated to milliseconds (multiples of 1000)
    dt = datetime(2026, 9, 27, 12, 0, 0, 123456)
    db_dt = to_db_millis(dt)
    assert db_dt.microsecond == 123000
