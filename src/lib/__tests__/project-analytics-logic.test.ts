import { describe, it, expect } from "vitest";
import {
  calculateBurndownSeries,
  calculateVelocityTrend,
  median,
  calculateCycleAndLeadTimes,
  calculateTeamWorkload,
  computeTaskFlowTimestamps,
} from "../project-analytics-logic";

describe("project-analytics-logic", () => {
  describe("median", () => {
    it("returns 0 for empty array", () => {
      expect(median([])).toBe(0);
    });

    it("returns middle element for odd length", () => {
      expect(median([5, 1, 9])).toBe(5);
    });

    it("returns average of middle elements for even length", () => {
      expect(median([1, 2, 4, 8])).toBe(3);
    });
  });

  describe("calculateBurndownSeries", () => {
    const sprintStartDate = new Date("2026-09-01T09:00:00Z");
    const sprintEndDate = new Date("2026-09-05T18:00:00Z");

    it("returns empty array if end date is before start date", () => {
      const result = calculateBurndownSeries({
        sprintStartDate: new Date("2026-09-10"),
        sprintEndDate: new Date("2026-09-01"),
        totalPlannedTasks: 10,
        tasksWithActivities: [],
      });
      expect(result).toEqual([]);
    });

    it("generates correct burndown points across sprint days", () => {
      const tasksWithActivities = [
        {
          id: "task-1",
          createdAt: new Date("2026-09-01T08:00:00Z"),
          completedAt: new Date("2026-09-02T12:00:00Z"),
          addedToSprintAt: null, // planned at sprint start
        },
        {
          id: "task-2",
          createdAt: new Date("2026-09-01T08:00:00Z"),
          completedAt: new Date("2026-09-04T15:00:00Z"),
          addedToSprintAt: null,
        },
        {
          id: "task-3",
          createdAt: new Date("2026-09-03T10:00:00Z"),
          completedAt: null,
          addedToSprintAt: new Date("2026-09-03T11:00:00Z"), // scope added mid-sprint
        },
      ];

      const points = calculateBurndownSeries({
        sprintStartDate,
        sprintEndDate,
        totalPlannedTasks: 2,
        tasksWithActivities,
      });

      expect(points.length).toBe(5); // Sept 1, 2, 3, 4, 5
      expect(points[0].idealRemaining).toBe(2);
      expect(points[4].idealRemaining).toBe(0); // last day pinned to 0

      // Day 1 (Sept 1): 2 in-scope, 0 completed => actualRemaining = 2
      expect(points[0].actualRemaining).toBe(2);
      expect(points[0].completedCount).toBe(0);
      expect(points[0].scopeAdded).toBe(0);

      // Day 2 (Sept 2): task-1 completed => actualRemaining = 1
      expect(points[1].completedCount).toBe(1);
      expect(points[1].actualRemaining).toBe(1);

      // Day 3 (Sept 3): task-3 added to sprint => scopeAdded = 1, actualRemaining = 2
      expect(points[2].scopeAdded).toBe(1);
      expect(points[2].actualRemaining).toBe(2);

      // Day 4 (Sept 4): task-2 completed => completedCount = 2, actualRemaining = 1
      expect(points[3].completedCount).toBe(2);
      expect(points[3].actualRemaining).toBe(1);
    });

    it("handles 1-day sprint without zero-division error", () => {
      const sameDay = new Date("2026-09-01T10:00:00Z");
      const points = calculateBurndownSeries({
        sprintStartDate: sameDay,
        sprintEndDate: sameDay,
        totalPlannedTasks: 5,
        tasksWithActivities: [],
      });
      expect(points.length).toBe(1);
      expect(points[0].idealRemaining).toBe(0);
    });
  });

  describe("calculateVelocityTrend", () => {
    it("returns 0 average velocity for empty sprint list", () => {
      const result = calculateVelocityTrend([]);
      expect(result.sprints).toEqual([]);
      expect(result.averageVelocity).toBe(0);
      expect(result.estimateSprintsForBacklog(10)).toBe(Infinity);
      expect(result.estimateSprintsForBacklog(0)).toBe(0);
    });

    it("calculates completion rate and average velocity correctly", () => {
      const completedSprints = [
        { id: "s-1", name: "Sprint 1", plannedCount: 10, completedCount: 8 },
        { id: "s-2", name: "Sprint 2", plannedCount: 12, completedCount: 12 },
      ];

      const result = calculateVelocityTrend(completedSprints);

      expect(result.sprints[0].completionRate).toBe(80);
      expect(result.sprints[1].completionRate).toBe(100);
      expect(result.averageVelocity).toBe(10); // (8 + 12) / 2
      expect(result.estimateSprintsForBacklog(25)).toBe(3); // ceil(25 / 10) = 3
      expect(result.estimateSprintsForBacklog(-5)).toBe(0);
    });
  });

  describe("calculateCycleAndLeadTimes", () => {
    it("calculates lead and cycle times accurately", () => {
      const dayMs = 86_400_000;
      const base = new Date("2026-09-01T00:00:00Z");

      const tasks = [
        {
          createdAt: base,
          inProgressAt: new Date(base.getTime() + 1 * dayMs),
          completedAt: new Date(base.getTime() + 3 * dayMs),
          stageDurations: { TODO: 24, IN_PROGRESS: 48 },
        },
        {
          createdAt: base,
          inProgressAt: new Date(base.getTime() + 2 * dayMs),
          completedAt: new Date(base.getTime() + 6 * dayMs),
          stageDurations: { TODO: 48, IN_PROGRESS: 96 },
        },
      ];

      const metrics = calculateCycleAndLeadTimes(tasks);

      // Lead times: [3, 6] => median 4.5, mean 4.5
      expect(metrics.medianLeadTimeDays).toBe(4.5);
      expect(metrics.averageLeadTimeDays).toBe(4.5);

      // Cycle times: [2, 4] => median 3, mean 3
      expect(metrics.medianCycleTimeDays).toBe(3);
      expect(metrics.averageCycleTimeDays).toBe(3);

      // Stage breakdown percentage
      expect(metrics.stageBreakdown.TODO).toBeDefined();
      expect(metrics.stageBreakdown.IN_PROGRESS).toBeDefined();
    });

    it("handles tasks without inProgressAt or stageDurations gracefully", () => {
      const base = new Date("2026-09-01T00:00:00Z");
      const metrics = calculateCycleAndLeadTimes([
        {
          createdAt: base,
          completedAt: new Date(base.getTime() + 86_400_000),
        },
      ]);

      expect(metrics.medianLeadTimeDays).toBe(1);
      expect(metrics.medianCycleTimeDays).toBe(0);
      expect(metrics.stageBreakdown).toEqual({});
    });
  });

  describe("calculateTeamWorkload", () => {
    it("distributes task priorities per member and detects overload", () => {
      const members = [
        { id: "u-1", name: "Alice" },
        { id: "u-2", name: "Bob" },
      ];

      const tasks = [
        { assignees: [{ userId: "u-1" }], priority: "HIGH" as const },
        { assignees: [{ userId: "u-1" }], priority: "URGENT" as const },
        { assignees: [{ userId: "u-2" }], priority: "LOW" as const },
      ];

      const workload = calculateTeamWorkload(members, tasks);

      expect(workload[0].id).toBe("u-1");
      expect(workload[0].totalOpenTasks).toBe(2);
      expect(workload[0].byPriority.HIGH).toBe(1);
      expect(workload[0].byPriority.URGENT).toBe(1);
      expect(workload[0].isOverloaded).toBe(false);

      expect(workload[1].id).toBe("u-2");
      expect(workload[1].totalOpenTasks).toBe(1);
      expect(workload[1].byPriority.LOW).toBe(1);
    });

    it("marks member overloaded when assigned >= 8 tasks", () => {
      const members = [{ id: "u-1", name: "Alice" }];
      const tasks = Array.from({ length: 8 }).map(() => ({
        assignees: [{ userId: "u-1" }],
        priority: "MEDIUM" as const,
      }));

      const workload = calculateTeamWorkload(members, tasks);
      expect(workload[0].isOverloaded).toBe(true);
    });
  });

  describe("computeTaskFlowTimestamps", () => {
    it("extracts inProgressAt and completedAt timestamps and calculates stage durations", () => {
      const t0 = new Date("2026-09-01T10:00:00Z");
      const t1 = new Date("2026-09-01T14:00:00Z"); // 4 hours in TODO
      const t2 = new Date("2026-09-01T18:00:00Z"); // 4 hours in IN_PROGRESS

      const result = computeTaskFlowTimestamps({
        createdAt: t0,
        initialStateGroup: "TODO",
        stateChangeActivities: [
          { createdAt: t1, toGroup: "IN_PROGRESS" },
          { createdAt: t2, toGroup: "DONE" },
        ],
      });

      expect(result.inProgressAt).toEqual(t1);
      expect(result.completedAt).toEqual(t2);
      expect(result.stageDurations.TODO).toBe(4);
      expect(result.stageDurations.IN_PROGRESS).toBe(4);
    });

    it("returns zero duration if no activities occurred", () => {
      const t0 = new Date("2026-09-01T10:00:00Z");
      const result = computeTaskFlowTimestamps({
        createdAt: t0,
        initialStateGroup: "BACKLOG",
        stateChangeActivities: [],
      });

      expect(result.inProgressAt).toBeNull();
      expect(result.completedAt).toBeNull();
      expect(result.stageDurations.BACKLOG).toBe(0);
    });
  });
});
