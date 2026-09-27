import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MIN_DESCRIPTION_LENGTH,
  evaluateTaskHygiene,
  hasAnyHygieneDefect,
  summarizeHygiene,
  buildHygieneReportNotification,
  type HygieneTaskInput,
} from "@/lib/hygiene-logic";
import { dispatchTaskHygieneReport } from "@/lib/hygiene-service";
import { prisma } from "@/lib/prisma";

describe("Agent-002 (Task Hygiene) — Pure Logic", () => {
  it("exports MIN_DESCRIPTION_LENGTH as 20", () => {
    expect(MIN_DESCRIPTION_LENGTH).toBe(20);
  });

  describe("evaluateTaskHygiene", () => {
    it("flags unassigned active task not in BACKLOG", () => {
      const defects = evaluateTaskHygiene({
        id: "task-1",
        stateGroup: "TODO",
        assigneeCount: 0,
        dueDate: new Date(),
        description: "This is a sufficiently long task description for testing.",
      });

      expect(defects.unassigned).toBe(true);
      expect(defects.missingDueDate).toBe(false);
      expect(defects.insufficientDescription).toBe(false);
    });

    it("does NOT flag unassigned task if in BACKLOG", () => {
      const defects = evaluateTaskHygiene({
        id: "task-2",
        stateGroup: "BACKLOG",
        assigneeCount: 0,
        dueDate: null,
        description: null,
      });

      expect(defects.unassigned).toBe(false);
      expect(defects.missingDueDate).toBe(false);
      expect(defects.insufficientDescription).toBe(false);
    });

    it("does NOT flag assigned task", () => {
      const defects = evaluateTaskHygiene({
        id: "task-3",
        stateGroup: "IN_PROGRESS",
        assigneeCount: 1,
        dueDate: new Date(),
        description: "Valid description that exceeds twenty characters easily.",
      });

      expect(defects.unassigned).toBe(false);
    });

    it("flags missing due date on TODO and IN_PROGRESS tasks", () => {
      const todoDefects = evaluateTaskHygiene({
        id: "task-todo",
        stateGroup: "TODO",
        assigneeCount: 1,
        dueDate: null,
        description: "Valid description that exceeds twenty characters easily.",
      });
      expect(todoDefects.missingDueDate).toBe(true);

      const inProgressDefects = evaluateTaskHygiene({
        id: "task-prog",
        stateGroup: "IN_PROGRESS",
        assigneeCount: 1,
        dueDate: null,
        description: "Valid description that exceeds twenty characters easily.",
      });
      expect(inProgressDefects.missingDueDate).toBe(true);
    });

    it("does NOT flag missing due date if dueDate is present", () => {
      const defects = evaluateTaskHygiene({
        id: "task-dated",
        stateGroup: "TODO",
        assigneeCount: 1,
        dueDate: new Date("2026-10-15"),
        description: "Valid description that exceeds twenty characters easily.",
      });
      expect(defects.missingDueDate).toBe(false);
    });

    it("flags insufficient description when null, empty, or under 20 trimmed chars", () => {
      // null description
      const nullDesc = evaluateTaskHygiene({
        id: "task-null-desc",
        stateGroup: "TODO",
        assigneeCount: 1,
        dueDate: new Date(),
        description: null,
      });
      expect(nullDesc.insufficientDescription).toBe(true);

      // short description (< 20 chars)
      const shortDesc = evaluateTaskHygiene({
        id: "task-short-desc",
        stateGroup: "TODO",
        assigneeCount: 1,
        dueDate: new Date(),
        description: "Too short desc",
      });
      expect(shortDesc.insufficientDescription).toBe(true);

      // 19 characters
      const nineteenChars = evaluateTaskHygiene({
        id: "task-19",
        stateGroup: "TODO",
        assigneeCount: 1,
        dueDate: new Date(),
        description: "1234567890123456789",
      });
      expect(nineteenChars.insufficientDescription).toBe(true);

      // Whitespace padding that trims to < 20 chars
      const paddedShort = evaluateTaskHygiene({
        id: "task-padded",
        stateGroup: "TODO",
        assigneeCount: 1,
        dueDate: new Date(),
        description: "   short text   ",
      });
      expect(paddedShort.insufficientDescription).toBe(true);
    });

    it("accepts description with 20 or more characters", () => {
      const exact20 = evaluateTaskHygiene({
        id: "task-20",
        stateGroup: "TODO",
        assigneeCount: 1,
        dueDate: new Date(),
        description: "12345678901234567890", // exactly 20 chars
      });
      expect(exact20.insufficientDescription).toBe(false);
    });

    it("evaluates multiple simultaneous defects", () => {
      const tripleDefect = evaluateTaskHygiene({
        id: "task-worst",
        stateGroup: "IN_PROGRESS",
        assigneeCount: 0,
        dueDate: null,
        description: "short",
      });

      expect(tripleDefect.unassigned).toBe(true);
      expect(tripleDefect.missingDueDate).toBe(true);
      expect(tripleDefect.insufficientDescription).toBe(true);
      expect(hasAnyHygieneDefect(tripleDefect)).toBe(true);
    });
  });

  describe("hasAnyHygieneDefect", () => {
    it("returns false when no defects exist", () => {
      expect(
        hasAnyHygieneDefect({
          unassigned: false,
          missingDueDate: false,
          insufficientDescription: false,
        }),
      ).toBe(false);
    });

    it("returns true when any defect is present", () => {
      expect(
        hasAnyHygieneDefect({
          unassigned: true,
          missingDueDate: false,
          insufficientDescription: false,
        }),
      ).toBe(true);
      expect(
        hasAnyHygieneDefect({
          unassigned: false,
          missingDueDate: true,
          insufficientDescription: false,
        }),
      ).toBe(true);
      expect(
        hasAnyHygieneDefect({
          unassigned: false,
          missingDueDate: false,
          insufficientDescription: true,
        }),
      ).toBe(true);
    });
  });

  describe("summarizeHygiene", () => {
    it("returns zero counts for empty task list", () => {
      const summary = summarizeHygiene([]);
      expect(summary).toEqual({
        unassigned: 0,
        missingDueDate: 0,
        insufficientDescription: 0,
        total: 0,
      });
    });

    it("correctly de-duplicates tasks with multiple defects in total count", () => {
      const tasks: HygieneTaskInput[] = [
        // Task 1: Clean
        {
          id: "t1",
          stateGroup: "TODO",
          assigneeCount: 1,
          dueDate: new Date(),
          description: "This is a clean task description that is long enough.",
        },
        // Task 2: unassigned + missingDueDate (2 defects, 1 task)
        {
          id: "t2",
          stateGroup: "TODO",
          assigneeCount: 0,
          dueDate: null,
          description: "This description is long enough to satisfy the minimum length.",
        },
        // Task 3: insufficientDescription only (1 defect, 1 task)
        {
          id: "t3",
          stateGroup: "IN_PROGRESS",
          assigneeCount: 1,
          dueDate: new Date(),
          description: "Short",
        },
        // Task 4: BACKLOG task with 0 assignees, null dueDate, null description (0 defects per backlog rules)
        {
          id: "t4",
          stateGroup: "BACKLOG",
          assigneeCount: 0,
          dueDate: null,
          description: null,
        },
      ];

      const summary = summarizeHygiene(tasks);
      expect(summary.unassigned).toBe(1);
      expect(summary.missingDueDate).toBe(1);
      expect(summary.insufficientDescription).toBe(1);
      // total distinct defective tasks is 2 (t2 and t3), NOT 3
      expect(summary.total).toBe(2);
    });
  });

  describe("buildHygieneReportNotification", () => {
    it("returns null when total defective tasks is 0", () => {
      const notification = buildHygieneReportNotification({
        pmName: "Ali Veli",
        summary: { unassigned: 0, missingDueDate: 0, insufficientDescription: 0, total: 0 },
        projectId: "prj-123",
      });
      expect(notification).toBeNull();
    });

    it("builds correct notification payload when defects exist", () => {
      const notification = buildHygieneReportNotification({
        pmName: "Selin Yılmaz",
        summary: { unassigned: 3, missingDueDate: 2, insufficientDescription: 4, total: 5 },
        projectId: "prj-456",
      });

      expect(notification).not.toBeNull();
      expect(notification?.title).toBe("Selin Yılmaz adına Pulse Asistan: Görev Hijyeni Raporu");
      expect(notification?.message).toBe(
        "5 görevde eksiklik tespit edildi (Atanmamış: 3, Tarihsiz: 2, Açıklamasız: 4). Lütfen panoyu gözden geçirin.",
      );
      expect(notification?.link).toBe("/projects/prj-456/board");
    });
  });
});

describe("Agent-002 (Task Hygiene) — Service Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if project not found", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue(null as any);

    await expect(dispatchTaskHygieneReport("non-existent")).rejects.toThrow("Project non-existent not found");
  });

  it("returns zero counts and skips report when agent is disabled", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-disabled",
      owner: { id: "owner-1", name: "Owner Name" },
      members: [{ user: { id: "admin-1", name: "Admin Name" } }],
      agentSettings: [{ enabled: false, pmUser: null }],
    } as any);

    const result = await dispatchTaskHygieneReport("prj-disabled");
    expect(result).toEqual({ tasksScanned: 0, defectiveTasks: 0, reportSent: false });
  });

  it("does not send report when all tasks are clean", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-clean",
      owner: { id: "owner-1", name: "Owner Name" },
      members: [{ user: { id: "admin-1", name: "Admin Name" } }],
      agentSettings: [{ enabled: true, pmUser: { id: "pm-1", name: "PM Person" } }],
    } as any);

    vi.spyOn(prisma.task, "findMany").mockResolvedValue([
      {
        id: "t1",
        state: { group: "TODO" },
        assignees: [{ id: "a1" }],
        dueDate: new Date(),
        description: "Valid description with plenty of characters to pass the check.",
      },
    ] as any);

    const result = await dispatchTaskHygieneReport("prj-clean");
    expect(result).toEqual({ tasksScanned: 1, defectiveTasks: 0, reportSent: false });
  });

  it("skips dispatch if report already sent today (same-day idempotency)", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-repeat",
      owner: { id: "owner-1", name: "Owner Name" },
      members: [{ user: { id: "admin-1", name: "Admin Name" } }],
      agentSettings: [{ enabled: true, pmUser: null }],
    } as any);

    vi.spyOn(prisma.task, "findMany").mockResolvedValue([
      {
        id: "t1",
        state: { group: "TODO" },
        assignees: [], // unassigned
        dueDate: null,
        description: null,
      },
    ] as any);

    // Existing notification sent today
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue({
      id: "notif-today",
    } as any);

    const result = await dispatchTaskHygieneReport("prj-repeat");
    expect(result).toEqual({ tasksScanned: 1, defectiveTasks: 1, reportSent: false });
  });

  it("dispatches notifications to ADMINs when defects exist and not sent today", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-defects",
      owner: { id: "owner-1", name: "Owner Name" },
      members: [{ user: { id: "admin-1", name: "Admin Name" } }],
      agentSettings: [{ enabled: true, pmUser: { id: "pm-1", name: "Zeynep PM" } }],
    } as any);

    vi.spyOn(prisma.task, "findMany").mockResolvedValue([
      {
        id: "t1",
        state: { group: "TODO" },
        assignees: [],
        dueDate: null,
        description: null,
      },
    ] as any);

    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.userNotificationPreference, "findUnique").mockResolvedValue(null);
    const createManySpy = vi.spyOn(prisma.notification, "createMany").mockResolvedValue({ count: 1 });

    const result = await dispatchTaskHygieneReport("prj-defects");
    expect(result).toEqual({ tasksScanned: 1, defectiveTasks: 1, reportSent: true });
    expect(createManySpy).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "admin-1",
          type: "TASK_MENTIONED",
          title: "Zeynep PM adına Pulse Asistan: Görev Hijyeni Raporu",
          link: "/projects/prj-defects/board",
        }),
      ],
    });
  });
});
