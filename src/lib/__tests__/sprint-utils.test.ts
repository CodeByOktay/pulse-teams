import { describe, it, expect } from "vitest";
import { isSprintOverdue, getSprintProgress, formatSprintDateRange } from "../sprint-utils";

describe("isSprintOverdue", () => {
  it("DRAFT sprint hiçbir zaman overdue değildir", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isSprintOverdue({ endDate: yesterday, status: "DRAFT" })).toBe(false);
  });

  it("ACTIVE sprint endDate geçmişse overdue'dur", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isSprintOverdue({ endDate: yesterday, status: "ACTIVE" })).toBe(true);
  });

  it("ACTIVE sprint endDate gelecekte ise overdue değildir", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isSprintOverdue({ endDate: tomorrow, status: "ACTIVE" })).toBe(false);
  });

  it("ACTIVE sprint endDate null ise overdue değildir", () => {
    expect(isSprintOverdue({ endDate: null, status: "ACTIVE" })).toBe(false);
  });

  it("COMPLETED sprint hiçbir zaman overdue değildir", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isSprintOverdue({ endDate: yesterday, status: "COMPLETED" })).toBe(false);
  });
});

describe("getSprintProgress", () => {
  it("boş sprint için sıfır değerler döner", () => {
    expect(getSprintProgress({ tasks: [] })).toEqual({
      total: 0,
      completed: 0,
      percentage: 0,
    });
  });

  it("4 görevden 2'si DONE ise yüzde 50 döner", () => {
    const sprint = {
      tasks: [
        { task: { state: { group: "DONE" as const } } },
        { task: { state: { group: "DONE" as const } } },
        { task: { state: { group: "TODO" as const } } },
        { task: { state: { group: "IN_PROGRESS" as const } } },
      ],
    };
    expect(getSprintProgress(sprint)).toEqual({ total: 4, completed: 2, percentage: 50 });
  });

  it("3 görevden 1 DONE + 1 CANCELLED ise completed 2 ve percentage 67 döner", () => {
    const sprint = {
      tasks: [
        { task: { state: { group: "DONE" as const } } },
        { task: { state: { group: "CANCELLED" as const } } },
        { task: { state: { group: "TODO" as const } } },
      ],
    };
    const result = getSprintProgress(sprint);
    expect(result.total).toBe(3);
    expect(result.completed).toBe(2);
    expect(result.percentage).toBe(67);
  });

  it("tüm görevler DONE ise percentage 100 döner", () => {
    const sprint = {
      tasks: [
        { task: { state: { group: "DONE" as const } } },
        { task: { state: { group: "DONE" as const } } },
      ],
    };
    expect(getSprintProgress(sprint)).toEqual({ total: 2, completed: 2, percentage: 100 });
  });
});

describe("formatSprintDateRange", () => {
  it("ikisi de null ise 'Tarih belirlenmedi' döner", () => {
    expect(formatSprintDateRange(null, null)).toBe("Tarih belirlenmedi");
  });

  it("sadece startDate varsa Türkçe kısa ay formatı döner", () => {
    const start = new Date(2026, 2, 5);
    expect(formatSprintDateRange(start, null)).toBe("5 Mar'dan itibaren");
  });

  it("sadece endDate varsa Türkçe kısa ay formatı döner", () => {
    const end = new Date(2026, 2, 20);
    expect(formatSprintDateRange(null, end)).toBe("20 Mar'a kadar");
  });

  it("ikisi de varsa 'dd MMM – dd MMM yyyy' formatı döner", () => {
    const start = new Date(2026, 2, 5);
    const end = new Date(2026, 2, 19);
    expect(formatSprintDateRange(start, end)).toBe("5 Mar – 19 Mar 2026");
  });
});
