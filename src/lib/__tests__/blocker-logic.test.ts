import { describe, it, expect } from "vitest";
import {
  analyzeBlockerChain,
  isFullyUnblocked,
  buildBlockerNotification,
  type BlockerRelationInput,
  type BlockerTaskInput,
} from "@/lib/blocker-logic";

describe("Blocker Logic (Agent-004)", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  describe("analyzeBlockerChain", () => {
    it("returns overdueBlocker when blocking task is overdue and not DONE", () => {
      const relations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-b" },
      ];
      const tasks: BlockerTaskInput[] = [
        {
          id: "task-a",
          stateGroup: "IN_PROGRESS",
          dueDate: new Date("2026-10-14T12:00:00Z"), // Yesterday
          updatedAt: new Date("2026-10-15T10:00:00Z"), // Updated recently
        },
        {
          id: "task-b",
          stateGroup: "TODO",
          dueDate: null,
          updatedAt: new Date("2026-10-15T11:00:00Z"),
        },
      ];

      const findings = analyzeBlockerChain(relations, tasks, now);
      expect(findings).toEqual([
        {
          type: "overdueBlocker",
          blockingTaskId: "task-a",
          blockedTaskId: "task-b",
        },
      ]);
    });

    it("returns staleBlocker when blocking task has not been updated for > 2 days and blocked task is waiting", () => {
      const relations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-b" },
      ];
      const tasks: BlockerTaskInput[] = [
        {
          id: "task-a",
          stateGroup: "TODO",
          dueDate: new Date("2026-10-20T12:00:00Z"), // Future due date
          updatedAt: new Date("2026-10-12T12:00:00Z"), // 3 days ago (stale)
        },
        {
          id: "task-b",
          stateGroup: "IN_PROGRESS", // Waiting group
          dueDate: null,
          updatedAt: new Date("2026-10-15T11:00:00Z"),
        },
      ];

      const findings = analyzeBlockerChain(relations, tasks, now);
      expect(findings).toEqual([
        {
          type: "staleBlocker",
          blockingTaskId: "task-a",
          blockedTaskId: "task-b",
        },
      ]);
    });

    it("does not report completed blocking tasks even if overdue or stale", () => {
      const relations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-b" },
      ];
      const tasks: BlockerTaskInput[] = [
        {
          id: "task-a",
          stateGroup: "DONE",
          dueDate: new Date("2026-10-10T12:00:00Z"),
          updatedAt: new Date("2026-10-10T12:00:00Z"),
        },
        {
          id: "task-b",
          stateGroup: "TODO",
          dueDate: null,
          updatedAt: new Date("2026-10-15T11:00:00Z"),
        },
      ];

      const findings = analyzeBlockerChain(relations, tasks, now);
      expect(findings).toEqual([]);
    });

    it("does not report staleBlocker if blocked task is already DONE or CANCELLED", () => {
      const relations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-b" },
      ];
      const tasks: BlockerTaskInput[] = [
        {
          id: "task-a",
          stateGroup: "IN_PROGRESS",
          dueDate: null,
          updatedAt: new Date("2026-10-10T12:00:00Z"), // Stale
        },
        {
          id: "task-b",
          stateGroup: "DONE", // Not waiting
          dueDate: null,
          updatedAt: new Date("2026-10-15T11:00:00Z"),
        },
      ];

      const findings = analyzeBlockerChain(relations, tasks, now);
      expect(findings).toEqual([]);
    });

    it("can return both overdueBlocker and staleBlocker if both conditions are met", () => {
      const relations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-b" },
      ];
      const tasks: BlockerTaskInput[] = [
        {
          id: "task-a",
          stateGroup: "IN_PROGRESS",
          dueDate: new Date("2026-10-13T12:00:00Z"), // Overdue (2 days ago)
          updatedAt: new Date("2026-10-12T12:00:00Z"), // Stale (3 days ago)
        },
        {
          id: "task-b",
          stateGroup: "IN_PROGRESS",
          dueDate: null,
          updatedAt: new Date("2026-10-15T11:00:00Z"),
        },
      ];

      const findings = analyzeBlockerChain(relations, tasks, now);
      expect(findings).toHaveLength(2);
      expect(findings.map((f) => f.type)).toEqual(["overdueBlocker", "staleBlocker"]);
    });
  });

  describe("isFullyUnblocked", () => {
    it("returns true when task has no blocking relations", () => {
      const allRelations: BlockerRelationInput[] = [];
      const completedIds = new Set<string>();

      expect(isFullyUnblocked("task-x", allRelations, completedIds)).toBe(true);
    });

    it("returns true when all blocking relations point to completed tasks", () => {
      const allRelations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-x" },
        { blockingTaskId: "task-b", blockedTaskId: "task-x" },
      ];
      const completedIds = new Set(["task-a", "task-b"]);

      expect(isFullyUnblocked("task-x", allRelations, completedIds)).toBe(true);
    });

    it("returns false if at least one blocker is not completed", () => {
      const allRelations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-x" },
        { blockingTaskId: "task-b", blockedTaskId: "task-x" },
      ];
      const completedIds = new Set(["task-a"]);

      expect(isFullyUnblocked("task-x", allRelations, completedIds)).toBe(false);
    });

    it("supports Array input for completedTaskIds", () => {
      const allRelations: BlockerRelationInput[] = [
        { blockingTaskId: "task-a", blockedTaskId: "task-x" },
      ];

      expect(isFullyUnblocked("task-x", allRelations, ["task-a"])).toBe(true);
      expect(isFullyUnblocked("task-x", allRelations, ["task-other"])).toBe(false);
    });
  });

  describe("buildBlockerNotification", () => {
    it("formats overdueBlocker notification correctly", () => {
      const notif = buildBlockerNotification({
        pmName: "Ayşe",
        type: "overdueBlocker",
        blockingTask: { identifier: "PRJ-1", title: "API Tasarımı" },
        blockedTask: { identifier: "PRJ-2", title: "Frontend Entegrasyonu" },
      });

      expect(notif.title).toBe("Ayşe adına Pulse Asistan: Engelleyen Görev Gecikti!");
      expect(notif.message).toContain("[PRJ-2] Frontend Entegrasyonu");
      expect(notif.message).toContain("[PRJ-1] API Tasarımı");
      expect(notif.message).toContain("teslim tarihi geçti");
    });

    it("formats staleBlocker notification correctly", () => {
      const notif = buildBlockerNotification({
        pmName: "Ali",
        type: "staleBlocker",
        blockingTask: { identifier: "PRJ-3", title: "Veritabanı Şeması" },
        blockedTask: { identifier: "PRJ-4", title: "Migration Çalıştırma" },
      });

      expect(notif.title).toBe("[Darboğaz Uyarısı] Bağımlılık Zinciri Tıkandı");
      expect(notif.message).toContain("2 gündür güncellenmediği için");
      expect(notif.message).toContain("[PRJ-3] Veritabanı Şeması");
    });
  });
});
