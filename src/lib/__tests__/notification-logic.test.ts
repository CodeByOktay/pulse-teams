import { describe, it, expect } from "vitest";
import {
  shouldDeliverNotification,
  formatNotificationSnippet,
  buildNotificationDeepLink,
  buildSprintNotificationDeepLink,
  countUnreadNotifications,
} from "../notification-logic";

describe("notification-logic", () => {
  describe("shouldDeliverNotification", () => {
    it("suppresses self-notifications when actorId matches recipientId", () => {
      expect(shouldDeliverNotification("user-1", "user-1")).toBe(false);
      expect(shouldDeliverNotification("admin-cuid-123", "admin-cuid-123")).toBe(false);
    });

    it("allows notifications when actorId is different from recipientId", () => {
      expect(shouldDeliverNotification("user-1", "user-2")).toBe(true);
      expect(shouldDeliverNotification("actor-a", "recipient-b")).toBe(true);
    });

    it("allows system notifications where actorId is null or undefined", () => {
      expect(shouldDeliverNotification(null, "user-1")).toBe(true);
      expect(shouldDeliverNotification(undefined, "user-1")).toBe(true);
    });

    it("handles empty strings correctly", () => {
      expect(shouldDeliverNotification("", "")).toBe(false);
      expect(shouldDeliverNotification("", "user-1")).toBe(true);
    });
  });

  describe("formatNotificationSnippet", () => {
    it("returns plain text unchanged when within maxLen", () => {
      const text = "Short comment about sprint goals.";
      expect(formatNotificationSnippet(text, 80)).toBe(text);
    });

    it("strips markdown formatting before truncation", () => {
      const markdown = "**Crucial update:** Please check the [documentation](https://docs.local) and `config.ts`.";
      const snippet = formatNotificationSnippet(markdown, 100);

      expect(snippet).not.toContain("**");
      expect(snippet).not.toContain("`");
      expect(snippet).not.toContain("[documentation]");
      expect(snippet).toContain("Crucial update:");
      expect(snippet).toContain("documentation");
      expect(snippet).toContain("config.ts");
    });

    it("truncates at word boundary with ellipsis when text exceeds maxLen", () => {
      const longText = "The quick brown fox jumps over the lazy dog and runs across the open field into the forest.";
      const snippet = formatNotificationSnippet(longText, 40);

      expect(snippet.length).toBeLessThanOrEqual(43); // 40 + "..."
      expect(snippet.endsWith("...")).toBe(true);
      expect(snippet).not.toContain("lazy dog");
    });

    it("uses default maxLen of 80 when not specified", () => {
      const longText = "A".repeat(50) + " " + "B".repeat(50);
      const snippet = formatNotificationSnippet(longText);

      expect(snippet.length).toBeLessThanOrEqual(83);
      expect(snippet.endsWith("...")).toBe(true);
    });

    it("handles text without spaces gracefully", () => {
      const noSpaces = "SupercalifragilisticexpialidociousAndEvenLongerStringWithoutAnySpaces";
      const snippet = formatNotificationSnippet(noSpaces, 20);

      expect(snippet.endsWith("...")).toBe(true);
    });

    it("handles empty and whitespace strings", () => {
      expect(formatNotificationSnippet("")).toBe("");
      expect(formatNotificationSnippet("   ")).toBe("");
    });
  });

  describe("buildNotificationDeepLink & buildSprintNotificationDeepLink", () => {
    it("builds correct board deep link with ?task= query parameter", () => {
      const link = buildNotificationDeepLink("proj-123", "task-456");
      expect(link).toBe("/projects/proj-123/board?task=task-456");
    });

    it("builds correct sprint deep link", () => {
      const link = buildSprintNotificationDeepLink("proj-123");
      expect(link).toBe("/projects/proj-123/sprints");
    });
  });

  describe("countUnreadNotifications", () => {
    it("returns 0 for empty array", () => {
      expect(countUnreadNotifications([])).toBe(0);
    });

    it("returns 0 when all notifications are read", () => {
      const list = [{ read: true }, { read: true }, { read: true }];
      expect(countUnreadNotifications(list)).toBe(0);
    });

    it("returns exact count of unread items", () => {
      const list = [
        { read: false },
        { read: true },
        { read: false },
        { read: false },
        { read: true },
      ];
      expect(countUnreadNotifications(list)).toBe(3);
    });

    it("returns total length when all are unread", () => {
      const list = [{ read: false }, { read: false }, { read: false }];
      expect(countUnreadNotifications(list)).toBe(3);
    });
  });
});
