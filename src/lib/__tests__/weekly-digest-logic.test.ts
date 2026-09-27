import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WEEKLY_DIGEST_AGENT_KEY,
  WEEKLY_DIGEST_TIME_ZONE,
  WEEKLY_DIGEST_HOUR,
  WEEKLY_DIGEST_MINUTE,
  SPRINT_HEALTH_LABELS,
  calculateWeeklyMetrics,
  resolveSprintHealthStatus,
  WeeklyDigestSchema,
  buildWeeklyDigestPrompt,
  formatWeeklyDigestMarkdown,
  getWeekNumber,
  shouldSkipDigest,
  type WeeklyTaskInput,
  type WeeklyMetrics,
} from "@/lib/weekly-digest-logic";
import { dispatchWeeklyDigest } from "@/lib/weekly-digest-service";
import { prisma } from "@/lib/prisma";
import * as weeklyDigestInterpreter from "@/lib/ai/weekly-digest-interpreter";
import * as notificationActions from "@/actions/notification";

describe("Agent-006 (Weekly Sprint Digest) — Pure Logic", () => {
  it("exports correct defaults, time zones, and constants", () => {
    expect(WEEKLY_DIGEST_AGENT_KEY).toBe("agent-006");
    expect(WEEKLY_DIGEST_TIME_ZONE).toBe("Europe/Istanbul");
    expect(WEEKLY_DIGEST_HOUR).toBe(17);
    expect(WEEKLY_DIGEST_MINUTE).toBe(0);
    expect(SPRINT_HEALTH_LABELS.ON_TRACK).toBe("Zamanında");
    expect(SPRINT_HEALTH_LABELS.AT_RISK).toBe("Riskli");
    expect(SPRINT_HEALTH_LABELS.BEHIND).toBe("Geride");
  });

  describe("calculateWeeklyMetrics", () => {
    const weekStart = new Date("2026-10-12T00:00:00.000Z"); // Monday
    const weekEnd = new Date("2026-10-16T14:00:00.000Z"); // Friday 17:00 Istanbul (14:00 UTC)

    it("aggregates completed tasks within weekStart and weekEnd accurately", () => {
      const tasks: WeeklyTaskInput[] = [
        {
          id: "t-1",
          stateGroup: "DONE",
          completedAt: new Date("2026-10-13T10:00:00.000Z"), // Tuesday -> completed this week
          dueDate: null,
        },
        {
          id: "t-2",
          stateGroup: "DONE",
          completedAt: new Date("2026-10-15T16:00:00.000Z"), // Thursday -> completed this week
          dueDate: null,
        },
        {
          id: "t-3-past",
          stateGroup: "DONE",
          completedAt: new Date("2026-10-10T10:00:00.000Z"), // Prior Saturday -> NOT this week
          dueDate: null,
        },
        {
          id: "t-4-future",
          stateGroup: "DONE",
          completedAt: new Date("2026-10-17T10:00:00.000Z"), // After weekEnd -> NOT this week
          dueDate: null,
        },
        {
          id: "t-5-no-completedAt",
          stateGroup: "DONE",
          completedAt: null,
          dueDate: null,
        },
        {
          id: "t-6-in-progress",
          stateGroup: "IN_PROGRESS",
          completedAt: new Date("2026-10-14T10:00:00.000Z"), // Not DONE -> NOT completed
          dueDate: null,
        },
      ];

      const metrics = calculateWeeklyMetrics({
        tasks,
        weekStart,
        weekEnd,
        sprint: { name: "Sprint 1", endDate: new Date("2026-10-18T20:59:00.000Z") },
        recentVelocities: [10, 15],
      });

      expect(metrics.completedThisWeek).toBe(2);
      expect(metrics.inProgressCount).toBe(1);
    });

    it("calculates overdue tasks against weekEnd reference point", () => {
      const tasks: WeeklyTaskInput[] = [
        {
          id: "t-overdue-1",
          stateGroup: "IN_PROGRESS",
          completedAt: null,
          dueDate: new Date("2026-10-14T10:00:00.000Z"), // Past due date
        },
        {
          id: "t-overdue-2",
          stateGroup: "TODO",
          completedAt: null,
          dueDate: new Date("2026-10-15T10:00:00.000Z"), // Past due date
        },
        {
          id: "t-done-with-past-due",
          stateGroup: "DONE",
          completedAt: new Date("2026-10-14T10:00:00.000Z"),
          dueDate: new Date("2026-10-13T10:00:00.000Z"), // Done -> NOT overdue
        },
        {
          id: "t-future-due",
          stateGroup: "IN_PROGRESS",
          completedAt: null,
          dueDate: new Date("2026-10-20T10:00:00.000Z"), // Future -> NOT overdue
        },
        {
          id: "t-no-due",
          stateGroup: "IN_PROGRESS",
          completedAt: null,
          dueDate: null,
        },
      ];

      const metrics = calculateWeeklyMetrics({
        tasks,
        weekStart,
        weekEnd,
        sprint: { name: "Sprint 1", endDate: null },
        recentVelocities: [],
      });

      expect(metrics.overdueCount).toBe(2);
      expect(metrics.inProgressCount).toBe(3);
    });

    it("calculates velocity and calendar days remaining in Europe/Istanbul", () => {
      // Friday 2026-10-16 17:00 Istanbul (14:00 UTC)
      // Sprint ends Sunday 2026-10-18 (ends in 2 calendar days)
      const sprintEnd = new Date("2026-10-18T18:00:00.000Z");

      const metrics = calculateWeeklyMetrics({
        tasks: [],
        weekStart,
        weekEnd,
        sprint: { name: "Sprint Oct-2", endDate: sprintEnd },
        recentVelocities: [10, 20], // (10 + 20) / 2 = 15
      });

      expect(metrics.velocity).toBe(15);
      expect(metrics.sprintName).toBe("Sprint Oct-2");
      expect(metrics.daysRemaining).toBe(2);
    });

    it("handles null sprint gracefully", () => {
      const metrics = calculateWeeklyMetrics({
        tasks: [],
        weekStart,
        weekEnd,
        sprint: null,
        recentVelocities: [],
      });

      expect(metrics.sprintName).toBeNull();
      expect(metrics.sprintEndDate).toBeNull();
      expect(metrics.daysRemaining).toBeNull();
    });
  });

  describe("resolveSprintHealthStatus (Deterministic Rules)", () => {
    const baseMetrics: WeeklyMetrics = {
      completedThisWeek: 5,
      inProgressCount: 2,
      overdueCount: 0,
      velocity: 5,
      sprintName: "Sprint 1",
      sprintEndDate: new Date(),
      daysRemaining: 5,
    };

    it("returns BEHIND when sprint expired/ending and unfinished or overdue work remains", () => {
      // Sprint ends today (daysRemaining = 0) but 1 task still in progress
      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: 0,
          inProgressCount: 1,
          overdueCount: 0,
        }),
      ).toBe("BEHIND");

      // Sprint ended yesterday (daysRemaining = -1) with overdue tasks
      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: -1,
          inProgressCount: 0,
          overdueCount: 2,
        }),
      ).toBe("BEHIND");
    });

    it("returns AT_RISK if any task is overdue", () => {
      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: 5,
          overdueCount: 1,
        }),
      ).toBe("AT_RISK");
    });

    it("returns AT_RISK if daysRemaining <= 2 and inProgressCount > velocity", () => {
      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: 2,
          inProgressCount: 6,
          velocity: 5,
          overdueCount: 0,
        }),
      ).toBe("AT_RISK");

      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: 1,
          inProgressCount: 10,
          velocity: 4,
          overdueCount: 0,
        }),
      ).toBe("AT_RISK");
    });

    it("returns ON_TRACK when within velocity and on schedule", () => {
      // 5 days remaining, normal workload
      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: 5,
          inProgressCount: 3,
          velocity: 5,
          overdueCount: 0,
        }),
      ).toBe("ON_TRACK");

      // 2 days remaining, inProgressCount <= velocity
      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: 2,
          inProgressCount: 4,
          velocity: 5,
          overdueCount: 0,
        }),
      ).toBe("ON_TRACK");

      // Sprint ended (daysRemaining = 0) with all work finished (0 in progress, 0 overdue)
      expect(
        resolveSprintHealthStatus({
          ...baseMetrics,
          daysRemaining: 0,
          inProgressCount: 0,
          overdueCount: 0,
        }),
      ).toBe("ON_TRACK");
    });
  });

  describe("WeeklyDigestSchema", () => {
    it("validates compliant digest payload", () => {
      const valid = {
        highlights: ["Auth servisi canlıya alındı", "Performans %30 arttı"],
        nextWeekPriorities: ["Kanban drag-drop testleri", "Sprint planlama"],
      };
      expect(WeeklyDigestSchema.parse(valid)).toEqual(valid);

      const emptyLists = {
        highlights: [],
        nextWeekPriorities: [],
      };
      expect(WeeklyDigestSchema.parse(emptyLists)).toEqual(emptyLists);
    });

    it("rejects invalid structures", () => {
      expect(() =>
        WeeklyDigestSchema.parse({
          highlights: "Not an array",
          nextWeekPriorities: [],
        }),
      ).toThrow();
    });
  });

  describe("buildWeeklyDigestPrompt", () => {
    it("generates prompt with role, metrics, and prompt injection guards", () => {
      const metrics: WeeklyMetrics = {
        completedThisWeek: 8,
        inProgressCount: 3,
        overdueCount: 0,
        velocity: 10,
        sprintName: "Sprint 42",
        sprintEndDate: new Date("2026-10-20"),
        daysRemaining: 4,
      };

      const { system, user } = buildWeeklyDigestPrompt({
        metrics,
        projectName: "Pulse Core",
        weekNumber: 41,
        healthStatus: "ON_TRACK",
      });

      expect(system).toContain("Kıdemli Çevik Proje Yöneticisi Asistanı");
      expect(system).toContain("<weekly_metrics>");
      expect(system).toContain("Do NOT include a status/health field");

      expect(user).toContain("Proje: Pulse Core");
      expect(user).toContain("Hafta: 41");
      expect(user).toContain("Sprint Durumu: Zamanında");
      expect(user).toContain("Bu Hafta Tamamlanan: 8");
      expect(user).toContain("Devam Eden: 3");
      expect(user).toContain("Velocity: 10");
      expect(user).toContain("Sprint: Sprint 42");
      expect(user).toContain("Kalan Gün: 4");
    });
  });

  describe("formatWeeklyDigestMarkdown", () => {
    const metrics: WeeklyMetrics = {
      completedThisWeek: 6,
      inProgressCount: 2,
      overdueCount: 0,
      velocity: 8,
      sprintName: "Sprint 1",
      sprintEndDate: new Date(),
      daysRemaining: 3,
    };

    it("formats markdown bulletin with provided highlights and priorities", () => {
      const markdown = formatWeeklyDigestMarkdown({
        weekNumber: 39,
        healthStatus: "ON_TRACK",
        metrics,
        highlights: ["Frontend API bağlantısı tamamlandı", "CI/CD boru hattı kuruldu"],
        nextWeekPriorities: ["E2E testlerin yazılması", "Beta dağıtımı"],
      });

      expect(markdown).toContain("### 📊 Haftalık Sprint Karnesi (Hafta 39)");
      expect(markdown).toContain("- **Sprint Durumu:** Zamanında");
      expect(markdown).toContain("- **Bu Hafta Tamamlanan:** 6 Görev");
      expect(markdown).toContain("- **Öne Çıkan Başarılar:** Frontend API bağlantısı tamamlandı; CI/CD boru hattı kuruldu");
      expect(markdown).toContain("- **Önümüzdeki Haftanın Öncelikleri:** E2E testlerin yazılması; Beta dağıtımı");
    });

    it("provides fallback text when highlights or priorities are empty", () => {
      const markdown = formatWeeklyDigestMarkdown({
        weekNumber: 39,
        healthStatus: "AT_RISK",
        metrics,
        highlights: [],
        nextWeekPriorities: [],
      });

      expect(markdown).toContain("- **Sprint Durumu:** Riskli");
      expect(markdown).toContain("- **Öne Çıkan Başarılar:** Bu hafta öne çıkan bir başarı kaydedilmedi.");
      expect(markdown).toContain("- **Önümüzdeki Haftanın Öncelikleri:** Önümüzdeki hafta için henüz öncelik belirlenmedi.");
    });
  });

  describe("getWeekNumber", () => {
    it("returns correct ISO week number in Europe/Istanbul", () => {
      // 2026-09-25 is Friday of week 39
      const d1 = new Date("2026-09-25T14:00:00.000Z");
      expect(getWeekNumber(d1)).toBe(39);

      // 2026-10-16 is Friday of week 42
      const d2 = new Date("2026-10-16T14:00:00.000Z");
      expect(getWeekNumber(d2)).toBe(42);
    });
  });

  describe("shouldSkipDigest", () => {
    it("returns true when active sprint does not exist", () => {
      expect(
        shouldSkipDigest({
          completedThisWeek: 0,
          inProgressCount: 0,
          overdueCount: 0,
          velocity: 0,
          sprintName: null,
          sprintEndDate: null,
          daysRemaining: null,
        }),
      ).toBe(true);
    });

    it("returns false when active sprint exists", () => {
      expect(
        shouldSkipDigest({
          completedThisWeek: 0,
          inProgressCount: 0,
          overdueCount: 0,
          velocity: 0,
          sprintName: "Active Sprint 1",
          sprintEndDate: new Date(),
          daysRemaining: 4,
        }),
      ).toBe(false);
    });
  });
});

describe("Agent-006 (Weekly Sprint Digest) — Service Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if project is not found", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue(null);

    await expect(dispatchWeeklyDigest("prj-nonexistent")).rejects.toThrow("Project prj-nonexistent not found");
  });

  it("skips and returns sent: false if agent-006 is explicitly disabled", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-1",
      name: "Pulse",
      owner: { id: "u-owner", name: "Owner" },
      members: [],
      agentSettings: [{ enabled: false }],
    } as any);

    const result = await dispatchWeeklyDigest("prj-1");
    expect(result).toEqual({ sent: false, healthStatus: null });
  });

  it("skips and returns sent: false if there is no active sprint", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-1",
      name: "Pulse",
      owner: { id: "u-owner", name: "Owner" },
      members: [],
      agentSettings: [{ enabled: true, pmUser: null }],
    } as any);

    vi.spyOn(prisma.sprint, "findFirst").mockResolvedValue(null);

    const result = await dispatchWeeklyDigest("prj-1");
    expect(result).toEqual({ sent: false, healthStatus: null });
  });

  it("skips if digest was already sent this week (dedup)", async () => {
    const now = new Date("2026-10-16T14:00:00.000Z"); // Friday

    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-1",
      name: "Pulse",
      owner: { id: "u-owner", name: "Owner" },
      members: [{ user: { id: "u-admin", name: "Admin" } }],
      agentSettings: [{ enabled: true, pmUser: null }],
    } as any);

    vi.spyOn(prisma.sprint, "findFirst").mockResolvedValue({
      id: "sprint-1",
      name: "Sprint 1",
      endDate: new Date("2026-10-18T20:00:00.000Z"),
    } as any);

    vi.spyOn(prisma.sprintTask, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.sprint, "findMany").mockResolvedValue([]);

    // Already sent
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue({
      id: "notif-sent",
    } as any);

    const result = await dispatchWeeklyDigest("prj-1", now);
    expect(result.sent).toBe(false);
    expect(result.healthStatus).toBe("ON_TRACK");
  });

  it("compiles digest and notifies ADMINs and PM when active sprint is running", async () => {
    const now = new Date("2026-10-16T14:00:00.000Z"); // Friday 17:00 Istanbul

    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-1",
      name: "Pulse Core",
      owner: { id: "u-owner", name: "Ahmet Owner" },
      members: [{ user: { id: "u-admin", name: "Ayşe Admin" } }],
      agentSettings: [{ enabled: true, pmUser: { id: "u-pm", name: "Mehmet PM" } }],
    } as any);

    vi.spyOn(prisma.sprint, "findFirst").mockResolvedValue({
      id: "sprint-1",
      name: "Sprint Alpha",
      endDate: new Date("2026-10-18T20:00:00.000Z"),
    } as any);

    vi.spyOn(prisma.sprintTask, "findMany").mockResolvedValue([
      {
        task: {
          id: "t-1",
          updatedAt: new Date("2026-10-14T10:00:00.000Z"),
          dueDate: null,
          state: { group: "DONE" },
        },
      },
    ] as any);

    vi.spyOn(prisma.sprint, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue(null); // not already sent
    vi.spyOn(prisma.userNotificationPreference, "findUnique").mockResolvedValue(null);

    vi.spyOn(weeklyDigestInterpreter, "analyzeWeeklyDigest").mockResolvedValue({
      highlights: ["Sprint hedeflerine ulaşıldı"],
      nextWeekPriorities: ["Yeni sprint hazırlıkları"],
    });

    const notifMock = vi.spyOn(notificationActions, "createNotification").mockResolvedValue({} as any);

    const result = await dispatchWeeklyDigest("prj-1", now);
    expect(result.sent).toBe(true);
    expect(result.healthStatus).toBe("ON_TRACK");

    // Both Admin and PM should receive the notification
    expect(notifMock).toHaveBeenCalledTimes(2);
    expect(notifMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "WEEKLY_DIGEST_PUBLISHED",
        title: "Haftalık Sprint Özeti Yayınlandı",
        message: expect.stringContaining("Mehmet PM adına Pulse Asistan"),
      }),
    );
  });
});
