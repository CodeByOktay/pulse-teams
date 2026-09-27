import { describe, it, expect } from "vitest";
import {
  calculateScopeCreep,
  buildScopeCreepNotification,
  DEFAULT_SCOPE_CREEP_THRESHOLD_PERCENT,
  DEFAULT_SCOPE_CREEP_MIN_INJECTED_TASKS,
  type ScopeCreepSprintInput,
  type ScopeCreepSprintTaskInput,
} from "@/lib/scope-creep-logic";

describe("Scope Creep Logic (Agent-009)", () => {
  const sprintStart = new Date("2026-10-01T09:00:00Z");
  const now = new Date("2026-10-08T12:00:00Z");

  const sprint: ScopeCreepSprintInput = {
    id: "sprint-1",
    name: "Sprint 42",
    startDate: sprintStart,
  };

  it("calculates zero creep when no tasks are added after sprint start", () => {
    const tasks: ScopeCreepSprintTaskInput[] = [
      { taskId: "task-1", addedAt: new Date("2026-10-01T08:00:00Z") },
      { taskId: "task-2", addedAt: new Date("2026-10-01T09:00:00Z") },
    ];

    const result = calculateScopeCreep(sprint, tasks, now);
    expect(result.baselineTaskCount).toBe(2);
    expect(result.injectedTaskCount).toBe(0);
    expect(result.growthRatePercent).toBe(0);
    expect(result.exceededThreshold).toBe(false);
  });

  it("triggers exceededThreshold when growth rate crosses percentage threshold (>= 15%)", () => {
    // 10 baseline tasks, 2 injected tasks = 20% growth rate >= 15%
    const baselineTasks: ScopeCreepSprintTaskInput[] = Array.from({ length: 10 }, (_, i) => ({
      taskId: `base-${i}`,
      addedAt: new Date("2026-10-01T08:30:00Z"),
    }));
    const injectedTasks: ScopeCreepSprintTaskInput[] = [
      { taskId: "inj-1", addedAt: new Date("2026-10-03T10:00:00Z") },
      { taskId: "inj-2", addedAt: new Date("2026-10-04T10:00:00Z") },
    ];

    const result = calculateScopeCreep(sprint, [...baselineTasks, ...injectedTasks], now);
    expect(result.baselineTaskCount).toBe(10);
    expect(result.injectedTaskCount).toBe(2);
    expect(result.growthRatePercent).toBe(20);
    expect(result.exceededThreshold).toBe(true);
  });

  it("triggers exceededThreshold when injected task count reaches min count (>= 3)", () => {
    // 50 baseline tasks, 3 injected tasks = 6% growth rate (< 15%), but count >= 3
    const baselineTasks: ScopeCreepSprintTaskInput[] = Array.from({ length: 50 }, (_, i) => ({
      taskId: `base-${i}`,
      addedAt: new Date("2026-10-01T08:00:00Z"),
    }));
    const injectedTasks: ScopeCreepSprintTaskInput[] = [
      { taskId: "inj-1", addedAt: new Date("2026-10-02T10:00:00Z") },
      { taskId: "inj-2", addedAt: new Date("2026-10-03T10:00:00Z") },
      { taskId: "inj-3", addedAt: new Date("2026-10-04T10:00:00Z") },
    ];

    const result = calculateScopeCreep(sprint, [...baselineTasks, ...injectedTasks], now);
    expect(result.baselineTaskCount).toBe(50);
    expect(result.injectedTaskCount).toBe(3);
    expect(result.growthRatePercent).toBe(6);
    expect(result.exceededThreshold).toBe(true);
  });

  it("handles empty baseline at start by defaulting baselineTaskCount to 1 to avoid division by zero", () => {
    const injectedTasks: ScopeCreepSprintTaskInput[] = [
      { taskId: "inj-1", addedAt: new Date("2026-10-02T10:00:00Z") },
    ];

    const result = calculateScopeCreep(sprint, injectedTasks, now);
    expect(result.baselineTaskCount).toBe(1);
    expect(result.injectedTaskCount).toBe(1);
    expect(result.growthRatePercent).toBe(100);
    expect(result.exceededThreshold).toBe(true);
  });

  it("formats scope creep notification copy accurately according to spec", () => {
    const notif = buildScopeCreepNotification({
      pmName: "Zeynep",
      sprintName: "Sprint 14",
      injectedTaskCount: 4,
      growthRatePercent: 25.4,
    });

    expect(notif.title).toBe("Zeynep adına Pulse Asistan: Kapsam Kayması Uyarısı");
    expect(notif.message).toBe(
      "'Sprint 14' sprintine başlangıçtan sonra 4 yeni görev eklendi (+%25 artış). Sprint hedefleri riske girebilir."
    );
  });
});
