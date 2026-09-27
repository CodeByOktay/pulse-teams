/**
 * Testable clock abstraction (Phase 6 — ADR-034).
 *
 * Production code should call `getNow()` instead of `new Date()` wherever the
 * current time drives business decisions, so tests and the application can pin the clock.
 */

let mockNow: Date | null = null;

/**
 * Time travel (mock clock mutations) is always available outside production; in
 * production it stays disabled unless `ENABLE_TIME_TRAVEL` is explicitly "true"/"1"
 * (ADR-036).
 */
export function isTimeTravelEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.ENABLE_TIME_TRAVEL === "true" || env.ENABLE_TIME_TRAVEL === "1";
}

/**
 * Returns the current date. When a mock clock is set, returns a
 * fresh copy of the mocked date instead.
 */
export function getNow(): Date {
  if (mockNow) {
    return new Date(mockNow.getTime());
  }
  return new Date();
}

/**
 * Checks whether the clock is currently pinned to a simulated time.
 */
export function isClockMocked(): boolean {
  return mockNow !== null;
}

/**
 * Returns the current mock date if set, or null if system clock is active.
 */
export function getMockClock(): Date | null {
  return mockNow ? new Date(mockNow.getTime()) : null;
}

/**
 * In-memory clock pin (for unit tests or temporary overrides).
 * Passing `null` clears the mock.
 */
export function setMockClock(date: Date | string | null): void {
  if (date === null) {
    mockNow = null;
  } else {
    mockNow = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  }
}

/**
 * In-memory clock reset (restores real system clock).
 */
export function resetMockClock(): void {
  mockNow = null;
}

export interface ClockStatus {
  isMocked: boolean;
  now: Date;
  mockTime: Date | null;
}

/**
 * Returns snapshot of current clock state.
 */
export function getClockStatus(): ClockStatus {
  return {
    isMocked: isClockMocked(),
    now: getNow(),
    mockTime: getMockClock(),
  };
}

/**
 * Loads the persisted mock clock from PostgreSQL (`SystemClock` table).
 * Synchronizes in-memory `mockNow` accordingly.
 */
export async function syncClockFromDb(): Promise<Date | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.systemClock.findUnique({
      where: { id: "current" },
    });
    if (row?.mockTime) {
      mockNow = new Date(row.mockTime);
      return new Date(mockNow.getTime());
    } else {
      mockNow = null;
      return null;
    }
  } catch {
    // If DB is unreachable or during unit tests, keep current in-memory state
    return mockNow ? new Date(mockNow.getTime()) : null;
  }
}

/**
 * Persists a simulated clock date to the database AND pins the in-memory clock.
 * Passing `null` clears the simulation.
 */
export async function persistMockClock(date: Date | string | null): Promise<Date | null> {
  setMockClock(date);
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.systemClock.upsert({
      where: { id: "current" },
      update: { mockTime: mockNow },
      create: { id: "current", mockTime: mockNow },
    });
  } catch (error) {
    console.error("[Clock] Failed to persist mock clock to database:", error);
  }
  return mockNow ? new Date(mockNow.getTime()) : null;
}

/**
 * Clears the persisted simulation from the database AND restores the real system clock in memory.
 */
export async function resetPersistedClock(): Promise<void> {
  resetMockClock();
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.systemClock.upsert({
      where: { id: "current" },
      update: { mockTime: null },
      create: { id: "current", mockTime: null },
    });
  } catch (error) {
    console.error("[Clock] Failed to reset persisted clock in database:", error);
  }
}
