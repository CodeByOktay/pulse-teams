from src.config import build_conninfo, Settings

def test_build_conninfo_strips_prisma_only_parameters():
    prisma_url = "postgresql://postgres:password@localhost:5432/pulse?schema=public&sslmode=disable&connection_limit=5"
    conninfo = build_conninfo(prisma_url)

    assert "schema=public" not in conninfo
    assert "connection_limit=5" not in conninfo
    assert "sslmode=disable" in conninfo
    assert "localhost:5432/pulse" in conninfo

def test_build_conninfo_handles_plain_url():
    url = "postgresql://user:pass@db:5432/pulse"
    assert build_conninfo(url) == url

def test_build_conninfo_handles_empty_or_whitespace():
    assert build_conninfo("") == ""
    assert build_conninfo("   ") == ""

def test_settings_default_values():
    s = Settings()
    assert s.TZ == "Europe/Istanbul"
    assert s.SCHEDULE_HOUR == 9
    assert s.EVENT_MAX_ATTEMPTS >= 1
    assert s.EVENT_LEASE_SECONDS > 0
