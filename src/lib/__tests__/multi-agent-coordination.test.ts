import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTimeTravelEnabled,
} from "@/lib/clock";
import {
  shouldEmitUnblock,
  computeLastBlockedAt,
} from "@/lib/blocker-logic";
import { resolveAgentNow } from "@/lib/internal-agent-request";
import { claimUnblockAnnouncement } from "@/lib/unblock-dedup";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/activity-logger", () => ({
  logActivity: vi.fn(),
}));

describe("Multi-Agent Coordination & Hardening (Phase 6 Step 6.08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isTimeTravelEnabled — Zaman Yolculuğu Güvenlik Kapısı", () => {
    it("geliştirme ve test ortamında (non-production) her zaman true döner", () => {
      expect(isTimeTravelEnabled({ NODE_ENV: "development" })).toBe(true);
      expect(isTimeTravelEnabled({ NODE_ENV: "test" })).toBe(true);
      expect(isTimeTravelEnabled({ NODE_ENV: undefined })).toBe(true);
    });

    it("production ortamında ENABLE_TIME_TRAVEL tanımlı değilse false döner", () => {
      expect(isTimeTravelEnabled({ NODE_ENV: "production" })).toBe(false);
      expect(isTimeTravelEnabled({ NODE_ENV: "production", ENABLE_TIME_TRAVEL: "" })).toBe(false);
      expect(isTimeTravelEnabled({ NODE_ENV: "production", ENABLE_TIME_TRAVEL: "false" })).toBe(false);
      expect(isTimeTravelEnabled({ NODE_ENV: "production", ENABLE_TIME_TRAVEL: "0" })).toBe(false);
    });

    it("production ortamında ENABLE_TIME_TRAVEL='true' veya '1' ise true döner", () => {
      expect(isTimeTravelEnabled({ NODE_ENV: "production", ENABLE_TIME_TRAVEL: "true" })).toBe(true);
      expect(isTimeTravelEnabled({ NODE_ENV: "production", ENABLE_TIME_TRAVEL: "1" })).toBe(true);
    });
  });

  describe("computeLastBlockedAt — Engel Zamanı Belirleme", () => {
    it("hiçbir ilişki veya aktivite yoksa null döner", () => {
      expect(computeLastBlockedAt({ relationCreatedAts: [], blockerStateChangedAts: [] })).toBeNull();
    });

    it("yalnızca ilişki oluşturulma zamanları varsa en yenisini döner", () => {
      const t1 = new Date("2026-09-20T10:00:00Z");
      const t2 = new Date("2026-09-22T14:30:00Z");
      const result = computeLastBlockedAt({
        relationCreatedAts: [t1, t2],
        blockerStateChangedAts: [],
      });
      expect(result).toEqual(t2);
    });

    it("ilişki ve durum değişikliği zamanları arasında en yeni olanı seçer", () => {
      const tRelation = new Date("2026-09-20T10:00:00Z");
      const tStateChange = new Date("2026-09-25T11:00:00Z");
      const result = computeLastBlockedAt({
        relationCreatedAts: [tRelation],
        blockerStateChangedAts: [tStateChange],
      });
      expect(result).toEqual(tStateChange);
    });
  });

  describe("shouldEmitUnblock — Çift Kanal Dedup Mantığı", () => {
    it("lastBlockedAt null ise hiçbir zaman unblock bildirimi yaymaz (false)", () => {
      expect(shouldEmitUnblock({ lastBlockedAt: null, lastUnblockedAt: null })).toBe(false);
      expect(shouldEmitUnblock({ lastBlockedAt: undefined, lastUnblockedAt: new Date() })).toBe(false);
    });

    it("daha önce hiç unblock edilmemişse ve engel varsa true döner (ilk unblock)", () => {
      expect(shouldEmitUnblock({ lastBlockedAt: new Date("2026-09-20T10:00:00Z"), lastUnblockedAt: null })).toBe(true);
      expect(shouldEmitUnblock({ lastBlockedAt: new Date("2026-09-20T10:00:00Z"), lastUnblockedAt: undefined })).toBe(true);
    });

    it("son unblock zamanından sonra yeni bir bloklama olmuşsa tekrar true döner (yeniden engellenme senaryosu)", () => {
      const previousUnblock = new Date("2026-09-22T10:00:00Z");
      const newBlock = new Date("2026-09-24T15:00:00Z");
      expect(shouldEmitUnblock({ lastBlockedAt: newBlock, lastUnblockedAt: previousUnblock })).toBe(true);
    });

    it("önceki unblock zamanından sonra yeni bloklama yoksa false döner (mükerrer engelleme koruması)", () => {
      const previousUnblock = new Date("2026-09-24T15:00:00Z");
      const oldBlock = new Date("2026-09-22T10:00:00Z");
      expect(shouldEmitUnblock({ lastBlockedAt: oldBlock, lastUnblockedAt: previousUnblock })).toBe(false);
      expect(shouldEmitUnblock({ lastBlockedAt: previousUnblock, lastUnblockedAt: previousUnblock })).toBe(false);
    });
  });

  describe("resolveAgentNow — Simüle Edilmiş İstek Zamanı Ayrıştırma", () => {
    it("asOf parametresi yoksa varsayılan effectiveNow döner", async () => {
      const result = await resolveAgentNow({});
      expect(result).toBeInstanceOf(Date);
    });

    it("geçerli bir ISO dizesi verildiğinde o zamanı döner", async () => {
      const iso = "2026-10-05T09:00:00.000Z";
      const result = await resolveAgentNow({ asOf: iso });
      expect(result?.toISOString()).toBe(iso);
    });

    it("geçersiz bir tarih verildiğinde null döner (400 Bad Request tetikleyicisi)", async () => {
      const result = await resolveAgentNow({ asOf: "not-a-valid-date" });
      expect(result).toBeNull();
    });

    it("asOf string dışında başka bir tipte verildiğinde null döner", async () => {
      const result = await resolveAgentNow({ asOf: 12345 });
      expect(result).toBeNull();
    });
  });

  describe("claimUnblockAnnouncement — Transaction & Advisory Lock ile Dedup", () => {
    it("shouldEmitUnblock false ise aktivite yazmaz ve false döner", async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        activity: {
          findFirst: vi.fn().mockResolvedValue({ createdAt: new Date("2026-09-25T10:00:00Z") }),
        },
        taskRelation: {
          findMany: vi.fn().mockResolvedValue([{ sourceTaskId: "src-1", createdAt: new Date("2026-09-20T10:00:00Z") }]),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const claimed = await claimUnblockAnnouncement("task-target", "actor-1");

      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(logActivity).not.toHaveBeenCalled();
      expect(claimed).toBe(false);
    });

    it("shouldEmitUnblock true ise TASK_UNBLOCKED aktivitesi yazar ve true döner", async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        activity: {
          findFirst: vi.fn()
            .mockResolvedValueOnce(null) // lastUnblocked is null (first unblock)
            .mockResolvedValueOnce({ createdAt: new Date("2026-09-20T08:00:00Z") }), // blockerStateChange
        },
        taskRelation: {
          findMany: vi.fn().mockResolvedValue([{ sourceTaskId: "src-1", createdAt: new Date("2026-09-20T10:00:00Z") }]),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const claimed = await claimUnblockAnnouncement("task-target", "actor-1");

      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith(mockTx, {
        type: "TASK_UNBLOCKED",
        taskId: "task-target",
        actorId: "actor-1",
      });
      expect(claimed).toBe(true);
    });
  });
});
