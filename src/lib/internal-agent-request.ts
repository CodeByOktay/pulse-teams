/**
 * Shared request-time resolution for the internal agent API (Phase 6 Step 6.08 — ADR-036 §3.2/§B3).
 *
 * Every internal agent route must evaluate business logic against the
 * application's effective clock (real or simulated), kept fresh via
 * `syncClockFromDb()`. Dispatch routes additionally accept an optional
 * `asOf` ISO timestamp in their POST body — this is how the Python Slot
 * Replay engine (`agent/src/replay.py`) tells Next.js to evaluate a missed
 * cron slot "as of" that slot's own time instead of the current effective now.
 */
import { getNow, syncClockFromDb } from "@/lib/clock";

/**
 * Resolves the `now` a dispatch route should evaluate against.
 *
 * - No `asOf` in the body -> syncs from DB and returns the current effective clock.
 * - `asOf` present and a valid ISO date string -> returns that exact Date (still
 *   syncs from DB first so `isTimeTravelEnabled`/mock-clock state stays current).
 * - `asOf` present but not a valid date -> returns `null` so the caller can
 *   respond with 400 `{ error: "Geçersiz asOf tarihi." }`.
 */
export async function resolveAgentNow(body: { asOf?: unknown }): Promise<Date | null> {
  await syncClockFromDb();

  if (body.asOf === undefined || body.asOf === null) {
    return getNow();
  }

  if (typeof body.asOf !== "string") {
    return null;
  }

  const parsed = new Date(body.asOf);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}
