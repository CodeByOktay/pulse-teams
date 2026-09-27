import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_STALE_DAYS,
  RESPONSE_TIMEOUT_DAYS,
  COMPLETION_PROPOSAL_CONFIDENCE,
  isValidQuickAction,
  resolveStaleDays,
  isTaskStale,
  hasRequestExpired,
  buildStatusRequestMessage,
  buildBlockedEscalationNotice,
  buildNonResponseEscalationNotice,
  buildCompletionProposalSummary,
  buildBlockerProposalDetails,
} from "@/lib/status-requester-logic";
import { dispatchStatusRequests, STATUS_REQUESTER_AGENT_KEY } from "@/lib/status-requester-service";
import { prisma } from "@/lib/prisma";
import * as progressActions from "@/actions/progress";

describe("Agent-003 (Status Requester) — Pure Logic", () => {
  it("exports correct defaults and constants", () => {
    expect(DEFAULT_STALE_DAYS).toBe(3);
    expect(RESPONSE_TIMEOUT_DAYS).toBe(2);
    expect(COMPLETION_PROPOSAL_CONFIDENCE).toBe(0.95);
    expect(STATUS_REQUESTER_AGENT_KEY).toBe("agent-003");
  });

  describe("isValidQuickAction", () => {
    it("validates allowed quick actions", () => {
      expect(isValidQuickAction("PROGRESSING")).toBe(true);
      expect(isValidQuickAction("BLOCKED")).toBe(true);
      expect(isValidQuickAction("COMPLETED")).toBe(true);
    });

    it("rejects invalid action strings", () => {
      expect(isValidQuickAction("DONE")).toBe(false);
      expect(isValidQuickAction("IN_PROGRESS")).toBe(false);
      expect(isValidQuickAction("progressing")).toBe(false);
      expect(isValidQuickAction("")).toBe(false);
      expect(isValidQuickAction("UNKNOWN")).toBe(false);
    });
  });

  describe("resolveStaleDays", () => {
    it("returns configured positive integer", () => {
      expect(resolveStaleDays({ staleDays: 5 })).toBe(5);
      expect(resolveStaleDays({ staleDays: 1 })).toBe(1);
      expect(resolveStaleDays({ staleDays: 14 })).toBe(14);
    });

    it("falls back to DEFAULT_STALE_DAYS for invalid or missing values", () => {
      expect(resolveStaleDays(undefined)).toBe(DEFAULT_STALE_DAYS);
      expect(resolveStaleDays(null)).toBe(DEFAULT_STALE_DAYS);
      expect(resolveStaleDays({})).toBe(DEFAULT_STALE_DAYS);
      expect(resolveStaleDays({ staleDays: 0 })).toBe(DEFAULT_STALE_DAYS);
      expect(resolveStaleDays({ staleDays: -3 })).toBe(DEFAULT_STALE_DAYS);
      expect(resolveStaleDays({ staleDays: 2.5 })).toBe(DEFAULT_STALE_DAYS);
      expect(resolveStaleDays({ staleDays: "3" })).toBe(DEFAULT_STALE_DAYS);
    });
  });

  describe("isTaskStale", () => {
    const now = new Date("2026-10-10T12:00:00Z");

    it("returns true when elapsed whole days >= staleDays", () => {
      // Exactly 3 days ago
      const threeDaysAgo = new Date("2026-10-07T12:00:00Z");
      expect(isTaskStale(threeDaysAgo, now, 3)).toBe(true);

      // 4 days ago
      const fourDaysAgo = new Date("2026-10-06T10:00:00Z");
      expect(isTaskStale(fourDaysAgo, now, 3)).toBe(true);
    });

    it("returns false when elapsed whole days < staleDays", () => {
      // 2 days and 23 hours ago (< 3 whole days)
      const almostThreeDays = new Date("2026-10-07T13:00:00Z");
      expect(isTaskStale(almostThreeDays, now, 3)).toBe(false);

      // 1 day ago
      const oneDayAgo = new Date("2026-10-09T12:00:00Z");
      expect(isTaskStale(oneDayAgo, now, 3)).toBe(false);

      // Just now
      expect(isTaskStale(now, now, 3)).toBe(false);
    });

    it("uses DEFAULT_STALE_DAYS when staleDays parameter is omitted", () => {
      const threeDaysAgo = new Date("2026-10-07T11:00:00Z");
      expect(isTaskStale(threeDaysAgo, now)).toBe(true);

      const twoDaysAgo = new Date("2026-10-08T12:00:00Z");
      expect(isTaskStale(twoDaysAgo, now)).toBe(false);
    });
  });

  describe("hasRequestExpired", () => {
    const now = new Date("2026-10-10T12:00:00Z");

    it("returns true when elapsed whole days >= timeoutDays (default 2)", () => {
      const twoDaysAgo = new Date("2026-10-08T12:00:00Z");
      expect(hasRequestExpired(twoDaysAgo, now)).toBe(true);

      const threeDaysAgo = new Date("2026-10-07T08:00:00Z");
      expect(hasRequestExpired(threeDaysAgo, now)).toBe(true);
    });

    it("returns false when elapsed whole days < timeoutDays", () => {
      const oneDayAgo = new Date("2026-10-09T12:00:00Z");
      expect(hasRequestExpired(oneDayAgo, now)).toBe(false);

      // 1 day and 20 hours (< 2 whole days)
      const almostTwoDays = new Date("2026-10-08T16:00:00Z");
      expect(hasRequestExpired(almostTwoDays, now)).toBe(false);
    });
  });

  describe("Notification & Proposal text builders", () => {
    it("builds status request message matching spec §3.2", () => {
      const msg = buildStatusRequestMessage({
        pmName: "Ayşe",
        taskIdentifier: "PRJ-14",
        taskTitle: "Implement OAuth2",
        staleDays: 3,
      });

      expect(msg.title).toBe("Ayşe adına Pulse Asistan");
      expect(msg.message).toBe('[PRJ-14] "Implement OAuth2" görevi 3 gündür güncellenmedi. Durumu nedir?');
    });

    it("builds blocked escalation notice matching spec §3.3.2", () => {
      const notice = buildBlockedEscalationNotice({
        assigneeName: "Canberk",
        taskIdentifier: "PRJ-22",
      });

      expect(notice.title).toBe("[Acil Engel] Canberk PRJ-22 görevinde takıldı!");
      expect(notice.message).toBe("[Acil Engel] Canberk PRJ-22 görevinde takıldı!");
    });

    it("builds non-response escalation notice matching spec §3.4", () => {
      const notice = buildNonResponseEscalationNotice({
        assigneeName: "Merve",
        taskIdentifier: "PRJ-35",
        taskTitle: "Database Indexing",
      });

      expect(notice.title).toBe("[Cevapsızlık] Durum Talebi Yanıtlanmadı");
      expect(notice.message).toBe(
        "Merve, '[PRJ-35] Database Indexing' görevi için gönderilen durum talebine 2 gündür yanıt vermedi.",
      );
    });

    it("builds completion proposal summary matching spec §3.3.1", () => {
      const summary = buildCompletionProposalSummary("PRJ-101");
      expect(summary).toBe(
        "[PRJ-101] Kullanıcı görevin tamamlandığını bildirdi. Durumun Tamamlandı'ya çekilmesi öneriliyor.",
      );
    });

    it("builds blocker proposal details matching spec §3.3.2", () => {
      const details = buildBlockerProposalDetails("PRJ-102");
      expect(details).toBe("[PRJ-102] Kullanıcı engelle karşılaştığını belirtti.");
    });
  });
});

describe("Agent-003 (Status Requester) — Service Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if project not found", async () => {
    vi.spyOn(prisma.project, "findUnique").mockResolvedValue(null as any);

    await expect(dispatchStatusRequests("non-existent")).rejects.toThrow("Project non-existent not found");
  });

  it("expires stale PENDING requests and notifies ADMINs", async () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const threeDaysAgo = new Date("2026-10-07T10:00:00Z");

    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-exp",
      identifier: "PRJ",
      owner: { id: "owner-1", name: "Project Owner" },
      members: [{ user: { id: "admin-1", name: "Admin One" } }],
      agentSettings: [{ enabled: true, pmUser: null, config: null }],
    } as any);

    // One expired PENDING request
    vi.spyOn(prisma.progressRequest, "findMany").mockResolvedValue([
      {
        id: "req-expired",
        createdAt: threeDaysAgo,
        task: {
          id: "task-1",
          title: "Overdue Task",
          sequenceId: 15,
          project: { identifier: "PRJ" },
        },
        recipient: { id: "user-1", name: "Ahmet" },
      },
    ] as any);

    const updateManySpy = vi.spyOn(prisma.progressRequest, "updateMany").mockResolvedValue({ count: 1 });
    const createManySpy = vi.spyOn(prisma.notification, "createMany").mockResolvedValue({ count: 1 });

    // No candidate stale tasks to open
    vi.spyOn(prisma.task, "findMany").mockResolvedValue([]);

    const result = await dispatchStatusRequests("prj-exp", now);

    expect(result.requestsExpired).toBe(1);
    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: "req-expired", status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    expect(createManySpy).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "admin-1",
          type: "PROGRESS_REQUESTED",
          title: "[Cevapsızlık] Durum Talebi Yanıtlanmadı",
          link: "/projects/prj-exp/board?task=task-1",
        }),
      ],
    });
  });

  it("opens new progress requests for stale IN_PROGRESS tasks and returns openedRequests", async () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const fourDaysAgo = new Date("2026-10-06T10:00:00Z");

    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-open",
      identifier: "PRJ",
      owner: { id: "owner-1", name: "Owner Name" },
      members: [{ user: { id: "admin-1", name: "Admin One" } }],
      agentSettings: [{ enabled: true, pmUser: { id: "pm-1", name: "PM Person" }, config: { staleDays: 3 } }],
    } as any);

    // No expired requests
    vi.spyOn(prisma.progressRequest, "findMany").mockResolvedValue([]);

    // One stale IN_PROGRESS task
    vi.spyOn(prisma.task, "findMany").mockResolvedValue([
      {
        id: "task-stale",
        sequenceId: 42,
        title: "Stale Backend API",
        updatedAt: fourDaysAgo,
        assignees: [{ user: { id: "dev-1", name: "Dev Developer" } }],
        state: { group: "IN_PROGRESS" },
      },
    ] as any);

    // No existing pending request
    vi.spyOn(prisma.progressRequest, "findFirst").mockResolvedValue(null);

    const createActionSpy = vi
      .spyOn(progressActions, "createProgressRequestForUser")
      .mockResolvedValue({ id: "req-new-123" } as any);

    const result = await dispatchStatusRequests("prj-open", now);

    expect(result.tasksScanned).toBe(1);
    expect(result.requestsOpened).toBe(1);
    expect(result.openedRequests).toEqual([
      { requestId: "req-new-123", taskId: "task-stale", recipientId: "dev-1" },
    ]);
    expect(createActionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: "pm-1",
        taskId: "task-stale",
        recipientId: "dev-1",
        reason: "scheduled",
        customTitle: "PM Person adına Pulse Asistan",
      }),
    );
  });

  it("skips opening new requests when task already has a PENDING request", async () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const fourDaysAgo = new Date("2026-10-06T10:00:00Z");

    vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      id: "prj-dup",
      identifier: "PRJ",
      owner: { id: "owner-1", name: "Owner Name" },
      members: [],
      agentSettings: [{ enabled: true, pmUser: null, config: null }],
    } as any);

    vi.spyOn(prisma.progressRequest, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.task, "findMany").mockResolvedValue([
      {
        id: "task-stale",
        sequenceId: 42,
        title: "Stale Backend API",
        updatedAt: fourDaysAgo,
        assignees: [{ user: { id: "dev-1", name: "Dev Developer" } }],
        state: { group: "IN_PROGRESS" },
      },
    ] as any);

    // Existing pending request already found
    vi.spyOn(prisma.progressRequest, "findFirst").mockResolvedValue({ id: "already-pending" } as any);
    const createActionSpy = vi.spyOn(progressActions, "createProgressRequestForUser");

    const result = await dispatchStatusRequests("prj-dup", now);
    expect(result.requestsOpened).toBe(0);
    expect(result.openedRequests).toHaveLength(0);
    expect(createActionSpy).not.toHaveBeenCalled();
  });
});
