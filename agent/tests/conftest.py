"""Shared pytest fixtures for pulse-agent (test cases are authored by Antigravity)."""

import pytest

from src.clock import reset_mock_clock


@pytest.fixture(autouse=True)
def _reset_clock():
    """Guarantee every test starts and ends with the real clock."""
    reset_mock_clock()
    yield
    reset_mock_clock()
