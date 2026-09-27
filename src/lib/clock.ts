/**
 * Testable clock abstraction (Phase 6 — ADR-034).
 *
 * Production code should call `getNow()` instead of `new Date()` wherever the
 * current time drives business decisions, so tests can pin the clock.
 */

let mockNow: Date | null = null;

/**
 * Returns the current date. When a mock clock is set (tests only), returns a
 * fresh copy of the mocked date instead.
 */
export function getNow(): Date {
  if (mockNow) {
    return new Date(mockNow.getTime());
  }
  return new Date();
}

/**
 * Test-only: pins the clock to `date`. Passing `null` clears the mock.
 */
export function setMockClock(date: Date | string | null): void {
  if (date === null) {
    mockNow = null;
  } else {
    mockNow = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  }
}

/**
 * Test-only: restores the real system clock.
 */
export function resetMockClock(): void {
  mockNow = null;
}
