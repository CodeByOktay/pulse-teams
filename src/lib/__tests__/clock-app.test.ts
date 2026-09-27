import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getNow,
  setMockClock,
  resetMockClock,
  isClockMocked,
  getMockClock,
  getClockStatus,
  syncClockFromDb,
  persistMockClock,
  resetPersistedClock,
} from "@/lib/clock";
import {
  getAppClockAction,
  setAppClockAction,
  resetAppClockAction,
} from "@/actions/clock";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemClock: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
  },
}));

describe("In-App Testable Clock Abstraction (TS + Python Integration)", () => {
  beforeEach(() => {
    resetMockClock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetMockClock();
  });

  it("reports clock is not mocked by default", () => {
    expect(isClockMocked()).toBe(false);
    expect(getMockClock()).toBeNull();
    const status = getClockStatus();
    expect(status.isMocked).toBe(false);
    expect(status.mockTime).toBeNull();
    expect(status.now).toBeInstanceOf(Date);
  });

  it("updates isClockMocked and getMockClock when clock is pinned", () => {
    const target = new Date("2026-10-01T09:00:00.000Z");
    setMockClock(target);

    expect(isClockMocked()).toBe(true);
    expect(getMockClock()?.toISOString()).toBe("2026-10-01T09:00:00.000Z");
    expect(getNow().toISOString()).toBe("2026-10-01T09:00:00.000Z");

    const status = getClockStatus();
    expect(status.isMocked).toBe(true);
    expect(status.mockTime?.toISOString()).toBe("2026-10-01T09:00:00.000Z");
  });

  it("resets clock cleanly", () => {
    setMockClock("2026-12-25T12:00:00.000Z");
    expect(isClockMocked()).toBe(true);

    resetMockClock();
    expect(isClockMocked()).toBe(false);
    expect(getMockClock()).toBeNull();
  });

  it("syncClockFromDb pins in-memory clock when SystemClock row has mockTime", async () => {
    const mockDate = new Date("2026-11-20T14:30:00.000Z");
    vi.mocked(prisma.systemClock.findUnique).mockResolvedValueOnce({
      id: "current",
      mockTime: mockDate,
      updatedAt: new Date(),
    } as any);

    const res = await syncClockFromDb();
    expect(res?.toISOString()).toBe("2026-11-20T14:30:00.000Z");
    expect(isClockMocked()).toBe(true);
    expect(getNow().toISOString()).toBe("2026-11-20T14:30:00.000Z");
  });

  it("syncClockFromDb resets in-memory clock when SystemClock row has null mockTime", async () => {
    setMockClock("2026-05-01T00:00:00.000Z");
    expect(isClockMocked()).toBe(true);

    vi.mocked(prisma.systemClock.findUnique).mockResolvedValueOnce({
      id: "current",
      mockTime: null,
      updatedAt: new Date(),
    } as any);

    const res = await syncClockFromDb();
    expect(res).toBeNull();
    expect(isClockMocked()).toBe(false);
  });

  it("persistMockClock saves to database and pins in-memory clock", async () => {
    const target = new Date("2026-10-15T09:00:00.000Z");
    vi.mocked(prisma.systemClock.upsert).mockResolvedValueOnce({
      id: "current",
      mockTime: target,
      updatedAt: new Date(),
    } as any);

    const res = await persistMockClock(target);
    expect(res?.toISOString()).toBe("2026-10-15T09:00:00.000Z");
    expect(isClockMocked()).toBe(true);
    expect(prisma.systemClock.upsert).toHaveBeenCalledWith({
      where: { id: "current" },
      update: { mockTime: expect.any(Date) },
      create: { id: "current", mockTime: expect.any(Date) },
    });
  });

  it("resetPersistedClock clears database mockTime and in-memory clock", async () => {
    setMockClock("2026-10-15T09:00:00.000Z");
    vi.mocked(prisma.systemClock.upsert).mockResolvedValueOnce({
      id: "current",
      mockTime: null,
      updatedAt: new Date(),
    } as any);

    await resetPersistedClock();
    expect(isClockMocked()).toBe(false);
    expect(prisma.systemClock.upsert).toHaveBeenCalledWith({
      where: { id: "current" },
      update: { mockTime: null },
      create: { id: "current", mockTime: null },
    });
  });

  describe("Clock Server Actions", () => {
    it("getAppClockAction returns current status after sync", async () => {
      vi.mocked(prisma.systemClock.findUnique).mockResolvedValueOnce({
        id: "current",
        mockTime: new Date("2026-10-20T08:00:00.000Z"),
        updatedAt: new Date(),
      } as any);

      const status = await getAppClockAction();
      expect(status.isMocked).toBe(true);
      expect(status.mockTimeIso).toBe("2026-10-20T08:00:00.000Z");
      expect(status.nowIso).toBe("2026-10-20T08:00:00.000Z");
    });

    it("setAppClockAction persists valid ISO date and returns serialized status", async () => {
      vi.mocked(prisma.systemClock.upsert).mockResolvedValueOnce({
        id: "current",
        mockTime: new Date("2026-11-01T09:00:00.000Z"),
        updatedAt: new Date(),
      } as any);

      const status = await setAppClockAction("2026-11-01T09:00:00.000Z");
      expect(status.isMocked).toBe(true);
      expect(status.mockTimeIso).toBe("2026-11-01T09:00:00.000Z");
      expect(status.nowIso).toBe("2026-11-01T09:00:00.000Z");
    });

    it("setAppClockAction rejects invalid date strings", async () => {
      await expect(setAppClockAction("invalid-date-string")).rejects.toThrow(
        "Geçersiz tarih formatı.",
      );
    });

    it("resetAppClockAction clears simulation and returns non-mocked status", async () => {
      setMockClock("2026-11-01T09:00:00.000Z");
      vi.mocked(prisma.systemClock.upsert).mockResolvedValueOnce({
        id: "current",
        mockTime: null,
        updatedAt: new Date(),
      } as any);

      const status = await resetAppClockAction();
      expect(status.isMocked).toBe(false);
      expect(status.mockTimeIso).toBeNull();
    });
  });
});
