/**
 * Internal agent API — GET / POST /api/internal/agent/clock (Phase 6).
 *
 * Allows pulse-agent container or testing harnesses to inspect or synchronize
 * the application-wide simulated clock.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalSignature } from "@/lib/internal-auth";
import {
  getClockStatus,
  persistMockClock,
  resetPersistedClock,
  syncClockFromDb,
} from "@/lib/clock";

export const dynamic = "force-dynamic";

export async function GET() {
  await syncClockFromDb();
  const status = getClockStatus();
  return NextResponse.json({
    isMocked: status.isMocked,
    now: status.now.toISOString(),
    mockTime: status.mockTime ? status.mockTime.toISOString() : null,
  });
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    await persistMockClock(targetDate);
  } else {
    await resetPersistedClock();
  }

  const status = getClockStatus();
  return NextResponse.json({
    isMocked: status.isMocked,
    now: status.now.toISOString(),
    mockTime: status.mockTime ? status.mockTime.toISOString() : null,
  });
}
