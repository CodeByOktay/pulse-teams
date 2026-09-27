import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCalendarDaysRemaining,
  shouldProcessDeadline,
  isOverdue,
  resolvePmName,
  buildDeadlineReminder,
  buildEscalationNotice,
  summarizeAgentRuns,
  getStartOfCalendarDay,
  DEADLINE_TRACKER_TIME_ZONE,
} from "@/lib/deadline-tracker-logic";
import { dispatchDueDateReminders } from "@/lib/deadline-tracker-service";
import { prisma } from "@/lib/prisma";

describe("Agent-001 (Deadline Tracker) — Pure Logic", () => {
  it("calculates whole calendar days remaining in Europe/Istanbul", () => {
    // 2026-10-10 10:00 Europe/Istanbul
    const now = new Date("2026-10-10T07:00:00.000Z");
    // Due 2026-10-13 14:00 Europe/Istanbul -> 3 calendar days
    const due3Days = new Date("2026-10-13T11:00:00.000Z");
    expect(getCalendarDaysRemaining(due3Days, now)).toBe(3);

    // Due 2026-10-11 23:59 Europe/Istanbul -> 1 calendar day
    const due1Day = new Date("2026-10-11T20:59:00.000Z");
    expect(getCalendarDaysRemaining(due1Day, now)).toBe(1);

    // Due today (2026-10-10 18:00 Europe/Istanbul) -> 0 calendar days
    const dueToday = new Date("2026-10-10T15:00:00.000Z");
    expect(getCalendarDaysRemaining(dueToday, now)).toBe(0);

    // Due yesterday (2026-10-09) -> -1 calendar days (overdue)
    const dueYesterday = new Date("2026-10-09T10:00:00.000Z");
    expect(getCalendarDaysRemaining(dueYesterday, now)).toBe(-1);
  });

  it("identifies processing thresholds correctly (3, 1, 0, <0)", () => {
    expect(shouldProcessDeadline(3)).toBe(true);
    expect(shouldProcessDeadline(1)).toBe(true);
    expect(shouldProcessDeadline(0)).toBe(true);
    expect(shouldProcessDeadline(-1)).toBe(true);
    expect(shouldProcessDeadline(-15)).toBe(true);

    // 2 days or 4+ days should NOT be processed
    expect(shouldProcessDeadline(2)).toBe(false);
    expect(shouldProcessDeadline(4)).toBe(false);
    expect(shouldProcessDeadline(10)).toBe(false);
  });

  it("identifies overdue state", () => {
    expect(isOverdue(-1)).toBe(true);
    expect(isOverdue(-10)).toBe(true);
    expect(isOverdue(0)).toBe(false);
    expect(isOverdue(1)).toBe(false);
  });

  it("resolves PM name falling back from PM user to Owner to default", () => {
    expect(resolvePmName("Ahmet Yılmaz", "Mehmet Demir")).toBe("Ahmet Yılmaz");
    expect(resolvePmName(null, "Mehmet Demir")).toBe("Mehmet Demir");
    expect(resolvePmName("", "Mehmet Demir")).toBe("Mehmet Demir");
    expect(resolvePmName(null, null)).toBe("Proje Yöneticisi");
  });

  it("builds reminder message text matching rules for 3 days, 1 day, 0 days, and overdue", () => {
    // 3 days remaining
    const rem3 = buildDeadlineReminder({
      pmName: "Ayşe",
      taskIdentifier: "PRJ-10",
      taskTitle: "Refactor API",
      daysRemaining: 3,
    });
    expect(rem3.title).toBe("Ayşe adına Pulse Asistan");
    expect(rem3.message).toBe("[PRJ-10] Refactor API görevinin teslimine 3 gün kaldı.");

    // 1 day remaining (special check message)
    const rem1 = buildDeadlineReminder({
      pmName: "Ayşe",
      taskIdentifier: "PRJ-10",
      taskTitle: "Refactor API",
      daysRemaining: 1,
    });
    expect(rem1.title).toBe("Ayşe adına Pulse Asistan");
    expect(rem1.message).toContain("1 gün kaldı! Lütfen durumunu kontrol edin.");

    // 0 days remaining (Urgent)
    const rem0 = buildDeadlineReminder({
      pmName: "Ayşe",
      taskIdentifier: "PRJ-10",
      taskTitle: "Refactor API",
      daysRemaining: 0,
    });
    expect(rem0.title).toContain("(Acil)");
    expect(rem0.message).toContain("bugün teslim edilmeli!");

    // Overdue (< 0)
    const remOverdue = buildDeadlineReminder({
      pmName: "Ayşe",
      taskIdentifier: "PRJ-10",
      taskTitle: "Refactor API",
      daysRemaining: -4,
    });
    expect(remOverdue.title).toContain("(Gecikme)");
    expect(remOverdue.message).toContain("teslim tarihi 4 gün geçti.");
  });

  it("builds escalation notice for overdue tasks to ADMINs", () => {
    const noticeWithAssignees = buildEscalationNotice({
      taskIdentifier: "PRJ-42",
      taskTitle: "Fix Database Deadlock",
      daysOverdue: 2,
      assigneeNames: ["Can Arslan", "Burak Şahin"],
    });
    expect(noticeWithAssignees.title).toBe("[Eskalasyon] Geciken Görev Uyarısı");
    expect(noticeWithAssignees.message).toContain("[PRJ-42] Fix Database Deadlock görevi 2 gün gecikti.");
    expect(noticeWithAssignees.message).toContain("Atananlar: Can Arslan, Burak Şahin");

    const noticeNoAssignees = buildEscalationNotice({
      taskIdentifier: "PRJ-43",
      taskTitle: "Orphan Task",
      daysOverdue: 5,
      assigneeNames: [],
    });
    expect(noticeNoAssignees.message).toContain("Atananlar: Atanan yok");
  });

  it("summarizes agent runs for dashboard widget", () => {
    const runs = [
      {
        status: "SUCCESS",
        scheduledFor: new Date("2026-09-25T09:00:00Z"),
        startedAt: new Date("2026-09-25T09:00:01Z"),
        completedAt: new Date("2026-09-25T09:00:05Z"),
        result: { remindersSent: 3, escalationsSent: 1 },
      },
      {
        status: "SUCCESS",
        scheduledFor: new Date("2026-09-26T09:00:00Z"),
        startedAt: new Date("2026-09-26T09:00:01Z"),
        completedAt: new Date("2026-09-26T09:00:04Z"),
        result: { remindersSent: 5, escalationsSent: 2 },
      },
    ];

    const summary = summarizeAgentRuns(runs);
    expect(summary.runCount).toBe(2);
    expect(summary.remindersSent).toBe(8);
    expect(summary.escalationsSent).toBe(3);
    expect(summary.lastRun?.status).toBe("SUCCESS");
    expect(summary.lastRun?.at).toEqual(new Date("2026-09-26T09:00:04Z"));

    const emptySummary = summarizeAgentRuns([]);
    expect(emptySummary.runCount).toBe(0);
    expect(emptySummary.remindersSent).toBe(0);
    expect(emptySummary.escalationsSent).toBe(0);
    expect(emptySummary.lastRun).toBeNull();
  });
});

describe("Agent-001 (Deadline Tracker) — Service Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips processing when agent-001 is explicitly disabled", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-1",
      identifier: "PRJ",
      name: "Test Project",
      owner: { id: "u-owner", name: "Project Owner" },
      members: [],
      agentSettings: [{ enabled: false }],
    } as any);

    const result = await dispatchDueDateReminders("prj-1");
    expect(result.tasksScanned).toBe(0);
    expect(result.remindersSent).toBe(0);
    expect(result.escalationsSent).toBe(0);
  });

  it("dispatches reminders and escalations for eligible tasks", async () => {
    const now = new Date("2026-10-10T09:00:00.000Z");

    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-1",
      identifier: "PRJ",
      name: "Pulse Core",
      owner: { id: "u-owner", name: "Ahmet" },
      members: [{ user: { id: "admin-1", name: "Admin User" } }],
      agentSettings: [{ enabled: true, pmUser: { id: "u-pm", name: "Ayşe PM" } }],
    } as any);

    const tasks = [
      {
        id: "task-3days",
        title: "Feature X",
        sequenceId: 1,
        dueDate: new Date("2026-10-13T09:00:00.000Z"), // 3 days remaining
        state: { name: "In Progress", group: "IN_PROGRESS" },
        assignees: [{ user: { id: "dev-1", name: "Dev One" } }],
      },
      {
        id: "task-overdue",
        title: "Bug Y",
        sequenceId: 2,
        dueDate: new Date("2026-10-08T09:00:00.000Z"), // 2 days overdue
        state: { name: "Ready", group: "TODO" },
        assignees: [{ user: { id: "dev-2", name: "Dev Two" } }],
      },
      {
        id: "task-2days-skipped",
        title: "Ignored Task",
        sequenceId: 3,
        dueDate: new Date("2026-10-12T09:00:00.000Z"), // 2 days -> should be skipped!
        state: { name: "Ready", group: "TODO" },
        assignees: [{ user: { id: "dev-1", name: "Dev One" } }],
      },
    ];

    vi.spyOn(prisma.task, "findMany").mockResolvedValue(tasks as any);
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue(null); // not already sent
    vi.spyOn(prisma.userNotificationPreference, "findUnique").mockResolvedValue({
      notifyDueDateApproaching: true,
    } as any);

    const createManyMock = vi.spyOn(prisma.notification, "createMany").mockResolvedValue({ count: 3 } as any);

    const result = await dispatchDueDateReminders("prj-1", now);

    expect(result.tasksScanned).toBe(3);
    expect(result.remindersSent).toBe(2); // task-3days (1) + task-overdue (1)
    expect(result.escalationsSent).toBe(1); // task-overdue -> admin-1

    expect(createManyMock).toHaveBeenCalled();
    const calls = createManyMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const createdData = (calls[0]![0] as any).data as any[];
    expect(createdData).toHaveLength(3);

    // Verify reminder format
    const reminderFor3Days = createdData.find((n) => n.userId === "dev-1");
    expect(reminderFor3Days?.title).toBe("Ayşe PM adına Pulse Asistan");
    expect(reminderFor3Days?.message).toContain("[PRJ-1] Feature X");

    // Verify escalation format
    const escalationForAdmin = createdData.find((n) => n.userId === "admin-1");
    expect(escalationForAdmin?.title).toBe("[Eskalasyon] Geciken Görev Uyarısı");
    expect(escalationForAdmin?.message).toContain("Bug Y görevi 2 gün gecikti.");
  });

  it("respects same-day idempotency and skips already sent notifications", async () => {
    const now = new Date("2026-10-10T09:00:00.000Z");

    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-1",
      identifier: "PRJ",
      name: "Pulse Core",
      owner: { id: "u-owner", name: "Ahmet" },
      members: [],
      agentSettings: [{ enabled: true, pmUser: null }],
    } as any);

    vi.spyOn(prisma.task, "findMany").mockResolvedValue([
      {
        id: "task-due-today",
        title: "Critical Fix",
        sequenceId: 5,
        dueDate: now,
        state: { name: "In Progress", group: "IN_PROGRESS" },
        assignees: [{ user: { id: "dev-1", name: "Dev One" } }],
      },
    ] as any);

    // Mock already sent notification
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue({
      id: "existing-notif-1",
    } as any);

    const createManyMock = vi.spyOn(prisma.notification, "createMany");

    const result = await dispatchDueDateReminders("prj-1", now);
    expect(result.remindersSent).toBe(0);
    expect(createManyMock).not.toHaveBeenCalled();
  });
});
