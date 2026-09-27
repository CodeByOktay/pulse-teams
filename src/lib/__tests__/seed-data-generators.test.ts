import { describe, it, expect } from "vitest";
import {
  createSeededRng,
  SEED_USERS,
  SEED_PROJECTS,
  SEED_STATE_TEMPLATES,
  SEED_LABEL_TEMPLATES,
  TASK_TYPE_WEIGHTS,
  PRIORITY_WEIGHTS,
  generateTaskTitle,
  generateTaskDescription,
  generateCommentContent,
  buildSprintWindows,
  randomDateBetween,
  SEED_RANGE_START,
} from "../../../prisma/seed-data-generators";

describe("seed-data-generators", () => {
  describe("createSeededRng", () => {
    it("produces deterministic pseudo-random sequences for identical seeds", () => {
      const rng1 = createSeededRng(42);
      const rng2 = createSeededRng(42);

      const seq1 = Array.from({ length: 10 }, () => rng1.next());
      const seq2 = Array.from({ length: 10 }, () => rng2.next());

      expect(seq1).toEqual(seq2);
    });

    it("produces distinct sequences for different seeds", () => {
      const rng1 = createSeededRng(42);
      const rng2 = createSeededRng(999);

      const val1 = rng1.next();
      const val2 = rng2.next();

      expect(val1).not.toBe(val2);
    });

    it("generates integers within specified [min, max] bounds inclusive", () => {
      const rng = createSeededRng(123);
      for (let i = 0; i < 50; i++) {
        const val = rng.int(5, 12);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(12);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it("picks items based on weights correctly", () => {
      const rng = createSeededRng(777);
      const items = [
        { value: "rare", weight: 1 },
        { value: "common", weight: 99 },
      ];

      const counts: Record<string, number> = { rare: 0, common: 0 };
      for (let i = 0; i < 200; i++) {
        const picked = rng.pickWeighted(items);
        counts[picked] = (counts[picked] ?? 0) + 1;
      }

      expect(counts.common).toBeGreaterThan(counts.rare);
      expect(counts.rare).toBeGreaterThan(0);
    });

    it("shuffles arrays without mutating original array length or contents", () => {
      const rng = createSeededRng(42);
      const original = [1, 2, 3, 4, 5, 6, 7, 8];
      const shuffled = rng.shuffle(original);

      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.slice().sort()).toEqual(original.slice().sort());
    });
  });

  describe("SEED_USERS & SEED_PROJECTS", () => {
    it("contains exactly 10 users with 1 ADMIN and 9 MEMBERs", () => {
      expect(SEED_USERS).toHaveLength(10);
      const admins = SEED_USERS.filter((u) => u.role === "ADMIN");
      const members = SEED_USERS.filter((u) => u.role === "MEMBER");

      expect(admins).toHaveLength(1);
      expect(admins[0].email).toBe("admin@pulse.local");
      expect(admins[0].name).toBe("Ahmet Yılmaz");
      expect(members).toHaveLength(9);
    });

    it("has unique user emails", () => {
      const emails = SEED_USERS.map((u) => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(SEED_USERS.length);
    });

    it("contains exactly 5 projects with unique identifiers summing to 500 tasks", () => {
      expect(SEED_PROJECTS).toHaveLength(5);
      const totalTasks = SEED_PROJECTS.reduce((sum, p) => sum + p.taskCount, 0);
      expect(totalTasks).toBe(500);

      const identifiers = SEED_PROJECTS.map((p) => p.identifier);
      expect(new Set(identifiers).size).toBe(5);
      expect(identifiers).toContain("CORE");
      expect(identifiers).toContain("ANL");
      expect(identifiers).toContain("AI");
      expect(identifiers).toContain("ADM");
      expect(identifiers).toContain("MOB");
    });

    it("verifies TASK_TYPE_WEIGHTS and PRIORITY_WEIGHTS sum to 100", () => {
      const taskWeightsSum = TASK_TYPE_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
      expect(taskWeightsSum).toBe(100);

      const priorityWeightsSum = PRIORITY_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
      expect(priorityWeightsSum).toBe(100);

      const priorities = PRIORITY_WEIGHTS.map((p) => p.value);
      expect(priorities).toEqual(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]);
    });
  });

  describe("SEED_STATE_TEMPLATES", () => {
    it("defines 8 Kanban states mapped to valid StateGroups with sequential order", () => {
      expect(SEED_STATE_TEMPLATES).toHaveLength(8);

      const names = SEED_STATE_TEMPLATES.map((s) => s.name);
      expect(names).toEqual([
        "Backlog",
        "Ready",
        "In Progress",
        "Code Review",
        "Testing",
        "Blocked",
        "Done",
        "Cancelled",
      ]);

      const defaultStates = SEED_STATE_TEMPLATES.filter((s) => s.isDefault);
      expect(defaultStates).toHaveLength(1);
      expect(defaultStates[0].name).toBe("Backlog");
      expect(defaultStates[0].group).toBe("BACKLOG");

      for (let i = 1; i < SEED_STATE_TEMPLATES.length; i++) {
        expect(SEED_STATE_TEMPLATES[i].sequence).toBeGreaterThan(SEED_STATE_TEMPLATES[i - 1].sequence);
      }
    });
  });

  describe("SEED_LABEL_TEMPLATES", () => {
    it("defines 30 unique labels across 5 domains (6 per domain)", () => {
      expect(SEED_LABEL_TEMPLATES).toHaveLength(30);

      const domains = ["Frontend", "Backend", "DevOps", "Process", "AI"] as const;
      for (const domain of domains) {
        const domainLabels = SEED_LABEL_TEMPLATES.filter((l) => l.domain === domain);
        expect(domainLabels).toHaveLength(6);
      }

      const names = SEED_LABEL_TEMPLATES.map((l) => l.name);
      expect(new Set(names).size).toBe(30);
    });
  });

  describe("Content Generators", () => {
    it("generates task titles with valid category prefix and non-empty subject", () => {
      const rng = createSeededRng(42);
      const title = generateTaskTitle(rng, "Bug", "Backend");

      expect(title.startsWith("[Bug] ")).toBe(true);
      expect(title.length).toBeGreaterThan(10);
    });

    it("generates markdown descriptions with checklists when requested", () => {
      const rng = createSeededRng(42);
      const descWithChecklist = generateTaskDescription(rng, {
        type: "Feature",
        includeChecklist: true,
        includeAttachment: false,
      });

      expect(descWithChecklist).toContain("**Yapılacaklar:**");
      expect(descWithChecklist).toContain("- [");
    });

    it("generates markdown descriptions with attachments when requested", () => {
      const rng = createSeededRng(42);
      const descWithAttachment = generateTaskDescription(rng, {
        type: "Feature",
        includeChecklist: false,
        includeAttachment: true,
      });

      expect(descWithAttachment).toMatch(/(📎|!\[)/);
    });

    it("generates comment content with natural engineering phrases", () => {
      const rng = createSeededRng(42);
      const comment = generateCommentContent(rng);

      expect(typeof comment).toBe("string");
      expect(comment.length).toBeGreaterThan(5);
    });
  });

  describe("Sprint & Date Utilities", () => {
    it("builds exactly 10 sprint windows covering 140 days (14 days each)", () => {
      const windows = buildSprintWindows(SEED_RANGE_START);

      expect(windows).toHaveLength(10);
      for (let i = 0; i < windows.length; i++) {
        expect(windows[i].index).toBe(i + 1);
        const durationDays = Math.round(
          (windows[i].end.getTime() - windows[i].start.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(durationDays).toBe(13); // Day 0 through Day 13 is 14 days inclusive

        if (i > 0) {
          expect(windows[i].start.getTime()).toBeGreaterThan(windows[i - 1].end.getTime());
        }
      }
    });

    it("generates random dates strictly bounded by start and end", () => {
      const rng = createSeededRng(42);
      const start = new Date("2026-02-01T00:00:00Z");
      const end = new Date("2026-02-15T00:00:00Z");

      for (let i = 0; i < 25; i++) {
        const d = randomDateBetween(rng, start, end);
        expect(d.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(d.getTime()).toBeLessThanOrEqual(end.getTime());
      }
    });
  });
});
