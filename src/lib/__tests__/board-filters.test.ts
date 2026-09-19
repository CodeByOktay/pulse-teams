import { describe, it, expect } from "vitest";
import { parseBoardFilters, isBoardFiltered, SORT_FIELDS } from "../board-filters";

describe("board-filters utility", () => {
  it("should parse empty searchParams to default empty filter state", () => {
    const result = parseBoardFilters({});
    expect(result).toEqual({
      priorities: [],
      labelIds: [],
      assigneeIds: [],
      groups: [],
      due: null,
      query: "",
      sort: null,
      order: "desc",
    });
    expect(isBoardFiltered(result)).toBe(false);
  });

  it("should parse valid priority CSV and ignore invalid priorities", () => {
    const result = parseBoardFilters({
      priority: "HIGH,URGENT,INVALID_PRIO,LOW",
    });
    expect(result.priorities).toEqual(["HIGH", "URGENT", "LOW"]);
    expect(isBoardFiltered(result)).toBe(true);
  });

  it("should parse multiple labels and assignees from CSV string", () => {
    const result = parseBoardFilters({
      label: "lbl_1,lbl_2, lbl_3",
      assignee: "user_a,user_b",
    });
    expect(result.labelIds).toEqual(["lbl_1", "lbl_2", "lbl_3"]);
    expect(result.assigneeIds).toEqual(["user_a", "user_b"]);
    expect(isBoardFiltered(result)).toBe(true);
  });

  it("should parse sorting field and order correctly", () => {
    const resultAsc = parseBoardFilters({
      sort: "dueDate",
      order: "asc",
    });
    expect(resultAsc.sort).toBe("dueDate");
    expect(resultAsc.order).toBe("asc");

    const resultInvalidSort = parseBoardFilters({
      sort: "maliciousColumn",
      order: "desc",
    });
    expect(resultInvalidSort.sort).toBeNull();
    expect(resultInvalidSort.order).toBe("desc");
  });

  it("should recognize all allowed sort fields", () => {
    expect(SORT_FIELDS).toContain("createdAt");
    expect(SORT_FIELDS).toContain("updatedAt");
    expect(SORT_FIELDS).toContain("priority");
    expect(SORT_FIELDS).toContain("dueDate");
  });
});
