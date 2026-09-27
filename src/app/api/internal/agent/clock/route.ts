/**
 * Internal agent API — GET / POST /api/internal/agent/clock (Phase 6, hardened Step 6.08 — ADR-036 §3.3).
 *
 * Allows pulse-agent container or testing harnesses to inspect or synchronize
 * the application-wide simulated clock. Both verbs require a valid HMAC
 * signature; GET carries no body so it is signed over the empty string
 * (mirrors `agent/src/internal_client.py` `_request`). POST additionally
 * requires `isTimeTravelEnabled()` (production stays locked unless
 * `ENABLE_TIME_TRAVEL` is explicitly set).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { getClockStatus, isTimeTravelEnabled, resetPersistedClock, syncClockFromDb } from "@/lib/clock";
import { applyMockClock } from "@/lib/clock-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyInternalSignature(request.headers, "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncClockFromDb();
  const status = getClockStatus();
  return NextResponse.json({
    isMocked: status.isMocked,
    now: status.now.toISOString(),
    mockTime: status.mockTime ? status.mockTime.toISOString() : null,
    timeTravelEnabled: isTimeTravelEnabled(),
  });
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTimeTravelEnabled()) {
    return NextResponse.json({ error: "Zaman yolculuğu bu ortamda devre dışı." }, { status: 403 });
  }

  let body: { mockTime?: string | null };
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const { mockTime } = body;
  if (mockTime) {
    const targetDate = new Date(mockTime);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Geçersiz mockTime tarihi." }, { status: 400 });
    }
    // Shared helper: persists the new clock and emits CLOCK_ADVANCED (actorId null,
    // this route has no session) only when the effective clock actually moves forward.
    await applyMockClock(targetDate, null);
  } else {
    await resetPersistedClock();
  }

  const status = getClockStatus();
  return NextResponse.json({
    isMocked: status.isMocked,
    now: status.now.toISOString(),
    mockTime: status.mockTime ? status.mockTime.toISOString() : null,
    timeTravelEnabled: isTimeTravelEnabled(),
  });
}
