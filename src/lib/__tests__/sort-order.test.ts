import { describe, it, expect } from "vitest";

function calculateNewSortOrder(
  tasks: { sortOrder: number }[],
  overIndex: number
): number {
  if (tasks.length === 0) return 65535;
  if (overIndex >= tasks.length) return tasks[tasks.length - 1].sortOrder + 10000;
  if (overIndex === 0) return tasks[0].sortOrder - 10000;
  const above = tasks[overIndex - 1].sortOrder;
  const below = tasks[overIndex].sortOrder;
  return (above + below) / 2;
}

describe("Kanban sort order calculation", () => {
  it("should return 65535 for an empty column", () => {
    expect(calculateNewSortOrder([], 0)).toBe(65535);
  });

  it("should calculate sortOrder for dropping at the end of a list", () => {
    const tasks = [{ sortOrder: 10000 }, { sortOrder: 20000 }];
    const newOrder = calculateNewSortOrder(tasks, 2);
    expect(newOrder).toBe(30000);
  });

  it("should calculate sortOrder for dropping at the start of a list", () => {
    const tasks = [{ sortOrder: 25000 }, { sortOrder: 35000 }];
    const newOrder = calculateNewSortOrder(tasks, 0);
    expect(newOrder).toBe(15000);
  });

  it("should calculate average sortOrder for inserting between two cards", () => {
    const tasks = [{ sortOrder: 10000 }, { sortOrder: 20000 }];
    const newOrder = calculateNewSortOrder(tasks, 1);
    expect(newOrder).toBe(15000);
  });
});
