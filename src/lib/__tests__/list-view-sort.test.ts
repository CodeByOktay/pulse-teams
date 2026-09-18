import { describe, it, expect } from "vitest";
import { sortTasksByField, groupTasksByState, type SortableTask } from "../list-view-sort";

function makeTask(overrides: Partial<SortableTask> & { id: string }): SortableTask {
  return {
    title: "Görev",
    priority: "NONE",
    dueDate: null,
    createdAt: new Date(2026, 0, 1),
    state: { id: "state-1", sequence: 1 },
    ...overrides,
  };
}

describe("sortTasksByField — öncelik sıralama", () => {
  it("desc sıralamada URGENT en önce gelir", () => {
    const tasks = [
      makeTask({ id: "1", priority: "LOW" }),
      makeTask({ id: "2", priority: "URGENT" }),
      makeTask({ id: "3", priority: "MEDIUM" }),
    ];
    const result = sortTasksByField(tasks, "priority", "desc");
    expect(result.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("asc sıralamada NONE en önce gelir", () => {
    const tasks = [
      makeTask({ id: "1", priority: "HIGH" }),
      makeTask({ id: "2", priority: "NONE" }),
      makeTask({ id: "3", priority: "LOW" }),
    ];
    const result = sortTasksByField(tasks, "priority", "asc");
    expect(result.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("eşit öncelikte createdAt'e göre asc tiebreak yapılır", () => {
    const tasks = [
      makeTask({ id: "1", priority: "HIGH", createdAt: new Date(2026, 0, 3) }),
      makeTask({ id: "2", priority: "HIGH", createdAt: new Date(2026, 0, 1) }),
      makeTask({ id: "3", priority: "HIGH", createdAt: new Date(2026, 0, 2) }),
    ];
    const result = sortTasksByField(tasks, "priority", "asc");
    expect(result.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("eşit öncelikte createdAt'e göre desc tiebreak yapılır", () => {
    const tasks = [
      makeTask({ id: "1", priority: "HIGH", createdAt: new Date(2026, 0, 3) }),
      makeTask({ id: "2", priority: "HIGH", createdAt: new Date(2026, 0, 1) }),
      makeTask({ id: "3", priority: "HIGH", createdAt: new Date(2026, 0, 2) }),
    ];
    const result = sortTasksByField(tasks, "priority", "desc");
    expect(result.map((t) => t.id)).toEqual(["1", "3", "2"]);
  });
});

describe("sortTasksByField — başlık sıralama", () => {
  it("alfabetik asc: Alpha < Beta < Gamma", () => {
    const tasks = [
      makeTask({ id: "1", title: "Gamma" }),
      makeTask({ id: "2", title: "Alpha" }),
      makeTask({ id: "3", title: "Beta" }),
    ];
    const result = sortTasksByField(tasks, "title", "asc");
    expect(result.map((t) => t.title)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("alfabetik desc: ters sıra", () => {
    const tasks = [
      makeTask({ id: "1", title: "Gamma" }),
      makeTask({ id: "2", title: "Alpha" }),
      makeTask({ id: "3", title: "Beta" }),
    ];
    const result = sortTasksByField(tasks, "title", "desc");
    expect(result.map((t) => t.title)).toEqual(["Gamma", "Beta", "Alpha"]);
  });
});

describe("sortTasksByField — createdAt ve stateOrder sıralama", () => {
  it("createdAt asc sıralar", () => {
    const tasks = [
      makeTask({ id: "1", createdAt: new Date(2026, 0, 3) }),
      makeTask({ id: "2", createdAt: new Date(2026, 0, 1) }),
    ];
    const result = sortTasksByField(tasks, "createdAt", "asc");
    expect(result.map((t) => t.id)).toEqual(["2", "1"]);
  });

  it("stateOrder state.sequence değerine göre sıralar", () => {
    const tasks = [
      makeTask({ id: "1", state: { id: "s3", sequence: 3 } }),
      makeTask({ id: "2", state: { id: "s1", sequence: 1 } }),
      makeTask({ id: "3", state: { id: "s2", sequence: 2 } }),
    ];
    const result = sortTasksByField(tasks, "stateOrder", "asc");
    expect(result.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });
});

describe("sortTasksByField — null dueDate edge case", () => {
  it("dueDate null olan görevler asc sıralamada sona düşer", () => {
    const tasks = [
      makeTask({ id: "1", dueDate: null }),
      makeTask({ id: "2", dueDate: new Date(2026, 0, 5) }),
      makeTask({ id: "3", dueDate: new Date(2026, 0, 1) }),
    ];
    const result = sortTasksByField(tasks, "dueDate", "asc");
    expect(result.map((t) => t.id)).toEqual(["3", "2", "1"]);
  });

  it("dueDate null olan görevler desc sıralamada da sona düşer", () => {
    const tasks = [
      makeTask({ id: "1", dueDate: null }),
      makeTask({ id: "2", dueDate: new Date(2026, 0, 5) }),
      makeTask({ id: "3", dueDate: new Date(2026, 0, 1) }),
    ];
    const result = sortTasksByField(tasks, "dueDate", "desc");
    expect(result.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("tüm dueDate değerleri null ise sıra değişmez", () => {
    const tasks = [makeTask({ id: "1", dueDate: null }), makeTask({ id: "2", dueDate: null })];
    const result = sortTasksByField(tasks, "dueDate", "asc");
    expect(result.map((t) => t.id)).toEqual(["1", "2"]);
  });
});

describe("groupTasksByState", () => {
  it("3 farklı state'teki görevler 3 grup oluşturur", () => {
    const tasks = [
      makeTask({ id: "1", state: { id: "s1", sequence: 1 } }),
      makeTask({ id: "2", state: { id: "s2", sequence: 2 } }),
      makeTask({ id: "3", state: { id: "s3", sequence: 3 } }),
    ];
    const grouped = groupTasksByState(tasks);
    expect(grouped.size).toBe(3);
  });

  it("boş girdi için boş Map döner", () => {
    const grouped = groupTasksByState([]);
    expect(grouped.size).toBe(0);
  });

  it("gruplar state.sequence sırasına göre oluşturulur", () => {
    const tasks = [
      makeTask({ id: "1", state: { id: "s3", sequence: 3 } }),
      makeTask({ id: "2", state: { id: "s1", sequence: 1 } }),
      makeTask({ id: "3", state: { id: "s2", sequence: 2 } }),
    ];
    const grouped = groupTasksByState(tasks);
    expect([...grouped.keys()]).toEqual(["s1", "s2", "s3"]);
  });

  it("aynı state'teki tüm görevler tek grupta toplanır", () => {
    const tasks = [
      makeTask({ id: "1", state: { id: "s1", sequence: 1 } }),
      makeTask({ id: "2", state: { id: "s1", sequence: 1 } }),
      makeTask({ id: "3", state: { id: "s2", sequence: 2 } }),
    ];
    const grouped = groupTasksByState(tasks);
    expect(grouped.get("s1")?.map((t) => t.id)).toEqual(["1", "2"]);
    expect(grouped.get("s2")?.map((t) => t.id)).toEqual(["3"]);
  });
});
