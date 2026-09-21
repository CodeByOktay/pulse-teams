import { describe, it, expect } from "vitest";
import {
  extractMentions,
  resolveMentionedUserIds,
  shouldDeliverWithPreferences,
  getApproachingDueTasks,
  formatDueDateNotificationSnippet,
} from "../notification-logic";
import type { NotificationType } from "@prisma/client";

describe("notification-preferences domain logic (Phase 4.03)", () => {
  describe("extractMentions", () => {
    it("extracts simple single-word mentions", () => {
      const text = "Hey @alex and @jane, please review this task.";
      expect(extractMentions(text)).toEqual(["alex", "jane"]);
    });

    it("extracts quoted mentions with spaces", () => {
      const text = 'Assigned to @"Ahmet Yılmaz" for initial review and @"John Doe" for signoff.';
      expect(extractMentions(text)).toEqual(["Ahmet Yılmaz", "John Doe"]);
    });

    it("handles mixed quoted and unquoted mentions", () => {
      const text = 'Ping @lead and @"Senior Architect" regarding PRJ-12.';
      expect(extractMentions(text)).toEqual(["lead", "Senior Architect"]);
    });

    it("deduplicates repeated mentions preserving first appearance order", () => {
      const text = "@alex said hi to @bob, then @alex and @charlie joined with @bob.";
      expect(extractMentions(text)).toEqual(["alex", "bob", "charlie"]);
    });

    it("supports usernames with hyphens and underscores", () => {
      const text = "Notify @dev-lead and @qa_specialist immediately.";
      expect(extractMentions(text)).toEqual(["dev-lead", "qa_specialist"]);
    });

    it("returns empty array when content contains no mentions", () => {
      expect(extractMentions("A standard comment without any handles.")).toEqual([]);
      expect(extractMentions("")).toEqual([]);
      expect(extractMentions("   ")).toEqual([]);
    });
  });

  describe("resolveMentionedUserIds", () => {
    const projectMembers = [
      { id: "usr-1", name: "Ahmet Yılmaz" },
      { id: "usr-2", name: "Ayşe Kaya" },
      { id: "usr-3", name: "Mehmet Demir" },
      { id: "usr-4", name: "John Doe" },
    ];

    it("matches exact full name case-insensitively", () => {
      const handles = ["ahmet yılmaz", "AYŞE KAYA"];
      const resolved = resolveMentionedUserIds(handles, projectMembers);
      expect(resolved).toEqual(["usr-1", "usr-2"]);
    });

    it("matches first name case-insensitively", () => {
      const handles = ["ahmet", "ayşe", "john"];
      const resolved = resolveMentionedUserIds(handles, projectMembers);
      expect(resolved).toEqual(["usr-1", "usr-2", "usr-4"]);
    });

    it("matches full name without spaces", () => {
      const handles = ["ahmetyılmaz", "johndoe"];
      const resolved = resolveMentionedUserIds(handles, projectMembers);
      expect(resolved).toEqual(["usr-1", "usr-4"]);
    });

    it("ignores mention handles that do not match any project member", () => {
      const handles = ["nonexistent", "nobody", "ahmet"];
      const resolved = resolveMentionedUserIds(handles, projectMembers);
      expect(resolved).toEqual(["usr-1"]);
    });

    it("returns empty array for empty handle or member lists", () => {
      expect(resolveMentionedUserIds([], projectMembers)).toEqual([]);
      expect(resolveMentionedUserIds(["ahmet"], [])).toEqual([]);
    });

    it("deduplicates user IDs when multiple aliases resolve to the same user", () => {
      const handles = ["Ahmet Yılmaz", "ahmet", "ahmetyılmaz"];
      const resolved = resolveMentionedUserIds(handles, projectMembers);
      expect(resolved).toEqual(["usr-1"]);
    });
  });

  describe("shouldDeliverWithPreferences", () => {
    it("strictly suppresses self-notifications regardless of preferences or notification type", () => {
      const types: NotificationType[] = [
        "TASK_ASSIGNED",
        "COMMENT_ADDED",
        "TASK_MENTIONED",
        "DUE_DATE_APPROACHING",
        "SPRINT_COMPLETED",
      ];

      for (const type of types) {
        expect(
          shouldDeliverWithPreferences({
            actorId: "usr-self",
            recipientId: "usr-self",
            type,
            preferences: {
              notifyTaskAssigned: true,
              notifyCommentAdded: true,
              notifyMentioned: true,
              notifyDueDateApproaching: true,
              notifySprintClosed: true,
            },
          }),
        ).toBe(false);
      }
    });

    it("allows system notifications (null or undefined actorId) when preferences allow", () => {
      expect(
        shouldDeliverWithPreferences({
          actorId: null,
          recipientId: "usr-1",
          type: "DUE_DATE_APPROACHING",
          preferences: { notifyDueDateApproaching: true },
        }),
      ).toBe(true);

      expect(
        shouldDeliverWithPreferences({
          actorId: undefined,
          recipientId: "usr-1",
          type: "TASK_ASSIGNED",
        }),
      ).toBe(true);
    });

    describe("default preference fallbacks (when preferences is null or undefined)", () => {
      it("defaults TASK_ASSIGNED to true", () => {
        expect(
          shouldDeliverWithPreferences({
            actorId: "usr-actor",
            recipientId: "usr-recipient",
            type: "TASK_ASSIGNED",
            preferences: null,
          }),
        ).toBe(true);
      });

      it("defaults COMMENT_ADDED to true", () => {
        expect(
          shouldDeliverWithPreferences({
            actorId: "usr-actor",
            recipientId: "usr-recipient",
            type: "COMMENT_ADDED",
            preferences: undefined,
          }),
        ).toBe(true);
      });

      it("defaults TASK_MENTIONED to true", () => {
        expect(
          shouldDeliverWithPreferences({
            actorId: "usr-actor",
            recipientId: "usr-recipient",
            type: "TASK_MENTIONED",
            preferences: null,
          }),
        ).toBe(true);
      });

      it("defaults DUE_DATE_APPROACHING to true", () => {
        expect(
          shouldDeliverWithPreferences({
            actorId: null,
            recipientId: "usr-recipient",
            type: "DUE_DATE_APPROACHING",
            preferences: null,
          }),
        ).toBe(true);
      });

      it("defaults SPRINT_COMPLETED to false (opt-in)", () => {
        expect(
          shouldDeliverWithPreferences({
            actorId: "usr-actor",
            recipientId: "usr-recipient",
            type: "SPRINT_COMPLETED",
            preferences: null,
          }),
        ).toBe(false);
      });
    });

    describe("user explicit preference overrides", () => {
      it("blocks notification when explicit preference is false", () => {
        expect(
          shouldDeliverWithPreferences({
            actorId: "actor",
            recipientId: "recipient",
            type: "TASK_ASSIGNED",
            preferences: { notifyTaskAssigned: false },
          }),
        ).toBe(false);

        expect(
          shouldDeliverWithPreferences({
            actorId: "actor",
            recipientId: "recipient",
            type: "COMMENT_ADDED",
            preferences: { notifyCommentAdded: false },
          }),
        ).toBe(false);

        expect(
          shouldDeliverWithPreferences({
            actorId: "actor",
            recipientId: "recipient",
            type: "TASK_MENTIONED",
            preferences: { notifyMentioned: false },
          }),
        ).toBe(false);

        expect(
          shouldDeliverWithPreferences({
            actorId: null,
            recipientId: "recipient",
            type: "DUE_DATE_APPROACHING",
            preferences: { notifyDueDateApproaching: false },
          }),
        ).toBe(false);

        expect(
          shouldDeliverWithPreferences({
            actorId: "actor",
            recipientId: "recipient",
            type: "SPRINT_COMPLETED",
            preferences: { notifySprintClosed: false },
          }),
        ).toBe(false);
      });

      it("delivers SPRINT_COMPLETED when explicitly enabled", () => {
        expect(
          shouldDeliverWithPreferences({
            actorId: "actor",
            recipientId: "recipient",
            type: "SPRINT_COMPLETED",
            preferences: { notifySprintClosed: true },
          }),
        ).toBe(true);
      });
    });
  });

  describe("getApproachingDueTasks", () => {
    const fixedNow = new Date("2026-09-22T10:00:00Z");

    it("identifies tasks due today (0 days), tomorrow (1 day), and in 3 days", () => {
      const tasks = [
        { id: "task-today", dueDate: new Date("2026-09-22T18:00:00Z"), stateGroup: "IN_PROGRESS" },
        { id: "task-tomorrow", dueDate: new Date("2026-09-23T12:00:00Z"), stateGroup: "TODO" },
        { id: "task-3days", dueDate: new Date("2026-09-25T15:00:00Z"), stateGroup: "TODO" },
      ];

      const result = getApproachingDueTasks(tasks, fixedNow);

      expect(result).toEqual([
        { id: "task-today", daysRemaining: 0 },
        { id: "task-tomorrow", daysRemaining: 1 },
        { id: "task-3days", daysRemaining: 3 },
      ]);
    });

    it("filters out tasks that are not at the 0, 1, or 3 day thresholds", () => {
      const tasks = [
        { id: "task-2days", dueDate: new Date("2026-09-24T12:00:00Z"), stateGroup: "TODO" },
        { id: "task-5days", dueDate: new Date("2026-09-27T12:00:00Z"), stateGroup: "TODO" },
        { id: "task-overdue", dueDate: new Date("2026-09-21T12:00:00Z"), stateGroup: "TODO" },
      ];

      const result = getApproachingDueTasks(tasks, fixedNow);
      expect(result).toEqual([]);
    });

    it("ignores tasks in DONE or CANCELLED state even if due date matches threshold", () => {
      const tasks = [
        { id: "task-done", dueDate: new Date("2026-09-22T18:00:00Z"), stateGroup: "DONE" },
        { id: "task-cancelled", dueDate: new Date("2026-09-23T12:00:00Z"), stateGroup: "CANCELLED" },
        { id: "task-valid", dueDate: new Date("2026-09-22T18:00:00Z"), stateGroup: "TODO" },
      ];

      const result = getApproachingDueTasks(tasks, fixedNow);
      expect(result).toEqual([{ id: "task-valid", daysRemaining: 0 }]);
    });

    it("ignores tasks without a dueDate", () => {
      const tasks = [
        { id: "task-no-date", dueDate: null, stateGroup: "TODO" },
      ];

      const result = getApproachingDueTasks(tasks, fixedNow);
      expect(result).toEqual([]);
    });

    it("handles empty task list gracefully", () => {
      expect(getApproachingDueTasks([], fixedNow)).toEqual([]);
    });
  });

  describe("formatDueDateNotificationSnippet", () => {
    it("formats message for 0 days remaining (today)", () => {
      expect(formatDueDateNotificationSnippet("Auth Refactoring", 0)).toBe(
        "Bugün son gün: Auth Refactoring",
      );
    });

    it("formats message for 1 day remaining (tomorrow)", () => {
      expect(formatDueDateNotificationSnippet("Database Migration", 1)).toBe(
        "Yarın son gün: Database Migration",
      );
    });

    it("formats message for 3 or more days remaining", () => {
      expect(formatDueDateNotificationSnippet("Sprint Review", 3)).toBe(
        "3 gün kaldı: Sprint Review",
      );
    });
  });
});
