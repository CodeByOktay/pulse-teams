import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STANDUP_AGENT_KEY,
  STANDUP_TIME_ZONE,
  STANDUP_OPEN_HOUR,
  STANDUP_OPEN_MINUTE,
  STANDUP_CUTOFF_HOUR,
  STANDUP_CUTOFF_MINUTE,
  getStandupWindow,
  isBeforeCutoff,
  isAfterCutoff,
  hasSubmittedStandup,
  shouldPublishSummary,
  summarizeStandupHeuristic,
  StandupSynthesisSchema,
  buildStandupSynthesisPrompt,
  type StandupEntryInput,
} from "@/lib/standup-logic";
import {
  openTodayStandup,
  submitStandupEntry,
  getTodayStandupForUser,
  synthesizeStandup,
} from "@/lib/standup-service";
import { prisma } from "@/lib/prisma";
import * as standupInterpreter from "@/lib/ai/standup-interpreter";
import * as notificationActions from "@/actions/notification";

describe("Agent-005 (Async Daily Standup) — Pure Logic", () => {
  it("exports correct defaults, time zones, and hours", () => {
    expect(STANDUP_AGENT_KEY).toBe("agent-005");
    expect(STANDUP_TIME_ZONE).toBe("Europe/Istanbul");
    expect(STANDUP_OPEN_HOUR).toBe(9);
    expect(STANDUP_OPEN_MINUTE).toBe(30);
    expect(STANDUP_CUTOFF_HOUR).toBe(11);
    expect(STANDUP_CUTOFF_MINUTE).toBe(30);
  });

  describe("getStandupWindow", () => {
    it("computes 09:30 open and 11:30 cutoff in Europe/Istanbul (UTC+3)", () => {
      // 2026-10-15 10:00:00 Europe/Istanbul is 2026-10-15T07:00:00.000Z
      const now = new Date("2026-10-15T07:00:00.000Z");
      const { openAt, cutoffAt } = getStandupWindow(now);

      // Start of day in Istanbul: 2026-10-15 00:00:00 Istanbul = 2026-10-14T21:00:00.000Z
      // Open: 09:30 Istanbul = 2026-10-15T06:30:00.000Z
      // Cutoff: 11:30 Istanbul = 2026-10-15T08:30:00.000Z
      expect(openAt.toISOString()).toBe("2026-10-15T06:30:00.000Z");
      expect(cutoffAt.toISOString()).toBe("2026-10-15T08:30:00.000Z");

      // Exactly 2 hours difference (120 minutes = 7,200,000 ms)
      expect(cutoffAt.getTime() - openAt.getTime()).toBe(2 * 60 * 60 * 1000);
    });

    it("correctly resolves calendar day across UTC boundary", () => {
      // 2026-10-15T22:00:00.000Z is 2026-10-16 01:00:00 in Istanbul
      const now = new Date("2026-10-15T22:00:00.000Z");
      const { openAt, cutoffAt } = getStandupWindow(now);

      // Should be 2026-10-16 open (06:30 UTC) and cutoff (08:30 UTC)
      expect(openAt.toISOString()).toBe("2026-10-16T06:30:00.000Z");
      expect(cutoffAt.toISOString()).toBe("2026-10-16T08:30:00.000Z");
    });
  });

  describe("isBeforeCutoff & isAfterCutoff", () => {
    it("reports before cutoff during morning window", () => {
      // 10:00 Istanbul (07:00 UTC) -> before 11:30 cutoff
      const morning = new Date("2026-10-15T07:00:00.000Z");
      expect(isBeforeCutoff(morning)).toBe(true);
      expect(isAfterCutoff(morning)).toBe(false);
    });

    it("handles boundary ms before and after cutoff", () => {
      // Cutoff instant: 11:30 Istanbul = 08:30:00.000 UTC
      const exactCutoff = new Date("2026-10-15T08:30:00.000Z");
      expect(isBeforeCutoff(exactCutoff)).toBe(false);
      expect(isAfterCutoff(exactCutoff)).toBe(true);

      const oneMsBefore = new Date("2026-10-15T08:29:59.999Z");
      expect(isBeforeCutoff(oneMsBefore)).toBe(true);
      expect(isAfterCutoff(oneMsBefore)).toBe(false);

      const oneMsAfter = new Date("2026-10-15T08:30:00.001Z");
      expect(isBeforeCutoff(oneMsAfter)).toBe(false);
      expect(isAfterCutoff(oneMsAfter)).toBe(true);
    });

    it("reports after cutoff in afternoon", () => {
      // 15:00 Istanbul (12:00 UTC) -> after 11:30 cutoff
      const afternoon = new Date("2026-10-15T12:00:00.000Z");
      expect(isBeforeCutoff(afternoon)).toBe(false);
      expect(isAfterCutoff(afternoon)).toBe(true);
    });
  });

  describe("hasSubmittedStandup", () => {
    it("returns true if user id is present in entries", () => {
      const entries = [{ userId: "u-1" }, { userId: "u-2" }];
      expect(hasSubmittedStandup(entries, "u-1")).toBe(true);
      expect(hasSubmittedStandup(entries, "u-2")).toBe(true);
    });

    it("returns false if user id is not present or list is empty", () => {
      const entries = [{ userId: "u-1" }];
      expect(hasSubmittedStandup(entries, "u-99")).toBe(false);
      expect(hasSubmittedStandup([], "u-1")).toBe(false);
    });
  });

  describe("shouldPublishSummary", () => {
    it("returns true only when entry count > 0", () => {
      expect(shouldPublishSummary(1)).toBe(true);
      expect(shouldPublishSummary(5)).toBe(true);
      expect(shouldPublishSummary(0)).toBe(false);
      expect(shouldPublishSummary(-1)).toBe(false);
    });
  });

  describe("summarizeStandupHeuristic (Zero-Failure Fallback)", () => {
    it("returns default message when entries array is empty", () => {
      const result = summarizeStandupHeuristic([]);
      expect(result.summary).toBe("Bugün hiç standup yanıtı girilmedi.");
      expect(result.blockers).toEqual([]);
    });

    it("formats member entries when no blockers are reported", () => {
      const entries: StandupEntryInput[] = [
        {
          userId: "u-1",
          userName: "Ahmet Yılmaz",
          yesterday: "Auth modülünü tamamladım",
          today: "API testlerini yazıyorum",
          blockers: null,
        },
        {
          userId: "u-2",
          userName: "Ayşe Kaya",
          yesterday: "UI kartlarını tasarladım",
          today: "Kanban tahtası entegrasyonu",
          blockers: "   ", // whitespace only -> no blocker
        },
      ];

      const result = summarizeStandupHeuristic(entries);
      expect(result.summary).toContain("👤 Üye Bazlı Özet");
      expect(result.summary).toContain("- **Ahmet Yılmaz**: Dün: Auth modülünü tamamladım · Bugün: API testlerini yazıyorum");
      expect(result.summary).toContain("- **Ayşe Kaya**: Dün: UI kartlarını tasarladım · Bugün: Kanban tahtası entegrasyonu");
      expect(result.summary).not.toContain("⚠️ Engeller");
      expect(result.blockers).toEqual([]);
    });

    it("extracts and formats blockers when present", () => {
      const entries: StandupEntryInput[] = [
        {
          userId: "u-1",
          userName: "Mehmet Demir",
          yesterday: "Backend API endpoints",
          today: "Database migration",
          blockers: "Veritabanı bağlantı hatası alıyorum",
        },
        {
          userId: "u-2",
          userName: "Fatma Şen",
          yesterday: "Tasarım incelemesi",
          today: "Figma güncellemesi",
          blockers: null,
        },
      ];

      const result = summarizeStandupHeuristic(entries);
      expect(result.summary).toContain("👤 Üye Bazlı Özet");
      expect(result.summary).toContain("⚠️ Engeller");
      expect(result.summary).toContain("- Mehmet Demir: Veritabanı bağlantı hatası alıyorum");
      expect(result.blockers).toEqual(["Mehmet Demir: Veritabanı bağlantı hatası alıyorum"]);
    });
  });

  describe("StandupSynthesisSchema", () => {
    it("validates compliant synthesis objects", () => {
      const valid = {
        summary: "🚀 Genel İlerleme Özeti: Ekip sprint hedeflerine uygun ilerliyor.",
        blockers: ["Ahmet: Redis bağlantısı bekleniyor"],
      };
      expect(StandupSynthesisSchema.parse(valid)).toEqual(valid);

      const validNoBlockers = {
        summary: "Genel özet: Her şey yolunda.",
        blockers: [],
      };
      expect(StandupSynthesisSchema.parse(validNoBlockers)).toEqual(validNoBlockers);
    });

    it("rejects summary shorter than 5 characters or invalid types", () => {
      expect(() =>
        StandupSynthesisSchema.parse({
          summary: "Kısa",
          blockers: [],
        }),
      ).toThrow();

      expect(() =>
        StandupSynthesisSchema.parse({
          summary: "Geçerli bir özet metni",
          blockers: "Engeller dizisi değil",
        }),
      ).toThrow();
    });
  });

  describe("buildStandupSynthesisPrompt", () => {
    it("builds prompt with anti-injection guards and formatted entries", () => {
      const entries: StandupEntryInput[] = [
        {
          userId: "u-1",
          userName: "Ali",
          yesterday: "Giriş ekranı",
          today: "Profil sayfası",
          blockers: null,
        },
        {
          userId: "u-2",
          userName: "Veli",
          yesterday: "Veritabanı",
          today: "Önbellekleme",
          blockers: "Redis portu kapalı",
        },
      ];

      const { system, user } = buildStandupSynthesisPrompt({
        entries,
        projectName: "Pulse Core",
      });

      expect(system).toContain("Kıdemli Çevik Proje Yöneticisi Asistanı");
      expect(system).toContain("<standup_entries>");
      expect(system).toContain("Respond ONLY with a single JSON object");

      expect(user).toContain("Proje: Pulse Core");
      expect(user).toContain("<standup_entries>");
      expect(user).toContain("- Ali | Dün: Giriş ekranı | Bugün: Profil sayfası | Engel: yok");
      expect(user).toContain("- Veli | Dün: Veritabanı | Bugün: Önbellekleme | Engel: Redis portu kapalı");
      expect(user).toContain("</standup_entries>");
    });
  });
});

describe("Agent-005 (Async Daily Standup) — Service Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("openTodayStandup", () => {
    it("skips and returns opened: false if agent-005 is explicitly disabled", async () => {
      vi.spyOn(prisma.agentSettings, "findUnique").mockResolvedValue({
        id: "as-1",
        projectId: "prj-1",
        agentKey: STANDUP_AGENT_KEY,
        enabled: false,
        config: null,
        pmUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await openTodayStandup("prj-1");
      expect(result).toEqual({ opened: false, standupId: null });
    });

    it("upserts daily standup record when agent is enabled", async () => {
      vi.spyOn(prisma.agentSettings, "findUnique").mockResolvedValue({
        id: "as-1",
        projectId: "prj-1",
        agentKey: STANDUP_AGENT_KEY,
        enabled: true,
        config: null,
        pmUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(prisma.dailyStandup, "upsert").mockResolvedValue({
        id: "standup-101",
        projectId: "prj-1",
        date: new Date("2026-10-15T00:00:00Z"),
        summary: null,
        blockers: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const now = new Date("2026-10-15T07:00:00Z");
      const result = await openTodayStandup("prj-1", now);
      expect(result).toEqual({ opened: true, standupId: "standup-101" });
      expect(prisma.dailyStandup.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId_date: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe("submitStandupEntry", () => {
    it("throws error if submitted after 11:30 Europe/Istanbul cutoff", async () => {
      // 14:00 Istanbul (11:00 UTC) -> after 11:30 cutoff
      const afterCutoff = new Date("2026-10-15T11:00:00.000Z");

      await expect(
        submitStandupEntry(
          {
            projectId: "prj-1",
            userId: "u-1",
            yesterday: "Dün",
            today: "Bugün",
          },
          afterCutoff,
        ),
      ).rejects.toThrow("Standup için giriş süresi doldu.");
    });

    it("throws error if standup is disabled for the project", async () => {
      // 10:00 Istanbul (07:00 UTC) -> before cutoff
      const beforeCutoff = new Date("2026-10-15T07:00:00.000Z");

      vi.spyOn(prisma.agentSettings, "findUnique").mockResolvedValue({
        id: "as-1",
        projectId: "prj-1",
        agentKey: STANDUP_AGENT_KEY,
        enabled: false,
        config: null,
        pmUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        submitStandupEntry(
          {
            projectId: "prj-1",
            userId: "u-1",
            yesterday: "Dün",
            today: "Bugün",
          },
          beforeCutoff,
        ),
      ).rejects.toThrow("Standup özelliği bu proje için etkin değil.");
    });

    it("upserts entry successfully before cutoff", async () => {
      const beforeCutoff = new Date("2026-10-15T07:00:00.000Z");

      vi.spyOn(prisma.agentSettings, "findUnique").mockResolvedValue({
        id: "as-1",
        projectId: "prj-1",
        agentKey: STANDUP_AGENT_KEY,
        enabled: true,
        config: null,
        pmUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(prisma.dailyStandup, "upsert").mockResolvedValue({
        id: "standup-101",
        projectId: "prj-1",
        date: new Date("2026-10-15T00:00:00Z"),
        summary: null,
        blockers: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(prisma.standupEntry, "upsert").mockResolvedValue({
        id: "entry-1",
        standupId: "standup-101",
        userId: "u-1",
        yesterday: "Dün X yaptım",
        today: "Bugün Y yapacağım",
        blockers: "Engel Z",
        submittedAt: new Date(),
      });

      const entry = await submitStandupEntry(
        {
          projectId: "prj-1",
          userId: "u-1",
          yesterday: "Dün X yaptım",
          today: "Bugün Y yapacağım",
          blockers: "  Engel Z  ",
        },
        beforeCutoff,
      );

      expect(entry.id).toBe("entry-1");
      expect(prisma.standupEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { standupId_userId: { standupId: "standup-101", userId: "u-1" } },
          create: expect.objectContaining({
            yesterday: "Dün X yaptım",
            today: "Bugün Y yapacağım",
            blockers: "Engel Z",
          }),
        }),
      );
    });
  });

  describe("getTodayStandupForUser", () => {
    it("returns null standup when no standup opened today", async () => {
      vi.spyOn(prisma.dailyStandup, "findUnique").mockResolvedValue(null);

      const result = await getTodayStandupForUser("prj-1", "u-1");
      expect(result).toEqual({ standup: null, hasSubmitted: false });
    });

    it("returns standup and submission status when record exists", async () => {
      vi.spyOn(prisma.dailyStandup, "findUnique").mockResolvedValue({
        id: "standup-101",
        projectId: "prj-1",
        date: new Date("2026-10-15T00:00:00Z"),
        summary: "Özet metni",
        blockers: ["Engel 1"],
        createdAt: new Date(),
        updatedAt: new Date(),
        entries: [{ userId: "u-1" }],
      } as any);

      const user1Result = await getTodayStandupForUser("prj-1", "u-1");
      expect(user1Result.standup?.id).toBe("standup-101");
      expect(user1Result.hasSubmitted).toBe(true);

      const user2Result = await getTodayStandupForUser("prj-1", "u-2");
      expect(user2Result.hasSubmitted).toBe(false);
    });
  });

  describe("synthesizeStandup", () => {
    it("returns published: false when no standup record exists", async () => {
      vi.spyOn(prisma.dailyStandup, "findUnique").mockResolvedValue(null);

      const result = await synthesizeStandup("prj-1");
      expect(result).toEqual({ entryCount: 0, published: false });
    });

    it("returns published: false and skips if already summarized (idempotent)", async () => {
      vi.spyOn(prisma.dailyStandup, "findUnique").mockResolvedValue({
        id: "standup-101",
        summary: "Mevcut özet",
        entries: [{ id: "e1" }, { id: "e2" }],
      } as any);

      const result = await synthesizeStandup("prj-1");
      expect(result).toEqual({ entryCount: 2, published: false });
    });

    it("returns published: false when 0 entries exist", async () => {
      vi.spyOn(prisma.dailyStandup, "findUnique").mockResolvedValue({
        id: "standup-101",
        summary: null,
        entries: [],
      } as any);

      const result = await synthesizeStandup("prj-1");
      expect(result).toEqual({ entryCount: 0, published: false });
    });

    it("synthesizes entries, updates record, and notifies project members", async () => {
      vi.spyOn(prisma.dailyStandup, "findUnique").mockResolvedValue({
        id: "standup-101",
        summary: null,
        entries: [
          {
            userId: "u-1",
            yesterday: "Auth",
            today: "UI",
            blockers: "API gecikmesi",
            user: { id: "u-1", name: "Can" },
          },
        ],
        project: {
          id: "prj-1",
          name: "Pulse Web",
          members: [{ userId: "u-1" }, { userId: "u-2" }],
        },
      } as any);

      vi.spyOn(standupInterpreter, "analyzeStandupText").mockResolvedValue({
        summary: "🚀 Günlük İlerleme: Can auth tamamladı.",
        blockers: ["Can: API gecikmesi"],
      });

      const updateMock = vi.spyOn(prisma.dailyStandup, "update").mockResolvedValue({} as any);
      const notifMock = vi.spyOn(notificationActions, "createNotification").mockResolvedValue({} as any);
      vi.spyOn(prisma.userNotificationPreference, "findUnique").mockResolvedValue(null);

      const result = await synthesizeStandup("prj-1");
      expect(result).toEqual({ entryCount: 1, published: true });

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: "standup-101" },
        data: {
          summary: "🚀 Günlük İlerleme: Can auth tamamladı.",
          blockers: ["Can: API gecikmesi"],
        },
      });

      // Notification sent to both members
      expect(notifMock).toHaveBeenCalledTimes(2);
      expect(notifMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "STANDUP_SUMMARY_PUBLISHED",
          title: "Günlük Standup Özeti Yayınlandı",
          message: expect.stringContaining("1 engel raporlandı"),
        }),
      );
    });
  });
});
