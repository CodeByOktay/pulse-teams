/**
 * Shared mock-clock mutation helper (Phase 6 Step 6.08 — ADR-036 §3.2/§3.3).
 *
 * Centralizes the "persist a new mock clock + emit CLOCK_ADVANCED when the
 * effective clock actually moves forward" logic so both `src/actions/clock.ts`
 * (session-gated, browser-triggered) and `POST /api/internal/agent/clock`
 * (HMAC-gated, Python-triggered) stay in sync. Rewinding the clock (or
 * resetting to the real system clock) must never emit `CLOCK_ADVANCED` —
 * only forward jumps do, since those are what `agent/src/replay.py` needs to
 * plan missed cron slots for.
 */
import { prisma } from "@/lib/prisma";
import { getNow, persistMockClock, syncClockFromDb } from "@/lib/clock";
import { emitGlobalDomainEvent } from "@/lib/domain-events";

export interface ApplyMockClockResult {
  previous: Date;
  current: Date;
  advanced: boolean;
}

/**
 * Persists `target` as the new simulated clock and emits a `CLOCK_ADVANCED`
 * DomainEvent (non-blocking; `emitGlobalDomainEvent` already try/catches)
 * whenever the effective "now" moves strictly forward.
 */
export async function applyMockClock(
  target: Date,
  actorId: string | null,
): Promise<ApplyMockClockResult> {
  await syncClockFromDb();
  const previous = getNow();

  await persistMockClock(target);
  const current = getNow();

  const advanced = current.getTime() > previous.getTime();
  if (advanced) {
    await emitGlobalDomainEvent(prisma, "CLOCK_ADVANCED", {
      previous: previous.toISOString(),
      current: current.toISOString(),
      actorId,
    });
  }

  return { previous, current, advanced };
}
