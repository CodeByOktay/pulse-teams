import { describe, it, expect } from "vitest";
import {
  shouldUpdateState,
  shouldUpdatePriority,
  resolveTaskSprintBadge,
  formatEmptyProperty,
  formatTaskDate,
  buildTaskBreadcrumb,
  buildTaskShareUrl,
  resolveOptimisticState,
} from "../task-detail-ux";

describe("shouldUpdateState", () => {
  it("aynı state id için false döner", () => {
    expect(shouldUpdateState("state-1", "state-1")).toBe(false);
  });

  it("farklı state id için true döner", () => {
    expect(shouldUpdateState("state-1", "state-2")).toBe(true);
  });
});

describe("shouldUpdatePriority", () => {
  it("aynı öncelik için false döner", () => {
    expect(shouldUpdatePriority("HIGH", "HIGH")).toBe(false);
  });

  it("farklı öncelik için true döner", () => {
    expect(shouldUpdatePriority("HIGH", "URGENT")).toBe(true);
  });
});

describe("resolveTaskSprintBadge", () => {
  it("hiç sprint yoksa backlog döner", () => {
    expect(resolveTaskSprintBadge([])).toEqual({ kind: "backlog" });
  });

  it("sadece DRAFT sprint varsa taslak rozeti döner", () => {
    const result = resolveTaskSprintBadge([{ id: "s1", name: "Sprint 1", status: "DRAFT" }]);
    expect(result).toEqual({ kind: "sprint", name: "Sprint 1", status: "DRAFT" });
  });

  it("sadece ACTIVE sprint varsa aktif rozeti döner", () => {
    const result = resolveTaskSprintBadge([{ id: "s1", name: "Sprint 1", status: "ACTIVE" }]);
    expect(result).toEqual({ kind: "sprint", name: "Sprint 1", status: "ACTIVE" });
  });

  it("hem DRAFT hem ACTIVE varsa ACTIVE tercih edilir", () => {
    const result = resolveTaskSprintBadge([
      { id: "s1", name: "Taslak Sprint", status: "DRAFT" },
      { id: "s2", name: "Aktif Sprint", status: "ACTIVE" },
    ]);
    expect(result).toEqual({ kind: "sprint", name: "Aktif Sprint", status: "ACTIVE" });
  });

  it("sadece COMPLETED sprint varsa backlog döner", () => {
    const result = resolveTaskSprintBadge([{ id: "s1", name: "Eski Sprint", status: "COMPLETED" }]);
    expect(result).toEqual({ kind: "backlog" });
  });
});

describe("formatEmptyProperty", () => {
  it("null değer için placeholder döner", () => {
    expect(formatEmptyProperty(null, "Atanmamış")).toBe("Atanmamış");
  });

  it("boşluk karakterlerinden oluşan değer için placeholder döner", () => {
    expect(formatEmptyProperty("   ", "Atanmamış")).toBe("Atanmamış");
  });

  it("gerçek bir değer varsa aynen döner", () => {
    expect(formatEmptyProperty("Ahmet Yılmaz", "Atanmamış")).toBe("Ahmet Yılmaz");
  });
});

describe("formatTaskDate", () => {
  it("null iso için varsayılan placeholder döner", () => {
    expect(formatTaskDate(null)).toBe("Tarih Belirtilmedi");
  });

  it("geçerli iso için Türkçe formatlı tarih döner", () => {
    const result = formatTaskDate("2026-03-05T00:00:00.000Z");
    expect(result).toContain("2026");
    expect(result).not.toBe("Tarih Belirtilmedi");
  });
});

describe("buildTaskBreadcrumb", () => {
  it("proje adı ve görev identifier'ını birleştirir", () => {
    expect(buildTaskBreadcrumb("Pulse", "PRJ", 12)).toBe("Pulse / PRJ-12");
  });
});

describe("buildTaskShareUrl", () => {
  it("origin, pathname ve taskId'den tam URL üretir", () => {
    expect(buildTaskShareUrl("http://localhost:3000", "/projects/1/board", "task-1")).toBe(
      "http://localhost:3000/projects/1/board?task=task-1",
    );
  });

  it("origin sonundaki eğik çizgiyi temizler", () => {
    expect(buildTaskShareUrl("http://localhost:3000/", "/projects/1/board", "task-1")).toBe(
      "http://localhost:3000/projects/1/board?task=task-1",
    );
  });
});

describe("resolveOptimisticState", () => {
  it("başarılı işlemde denenen değeri döner", () => {
    expect(resolveOptimisticState(true, "state-2", "state-1")).toBe("state-2");
  });

  it("başarısız işlemde önceki değere geri döner (rollback)", () => {
    expect(resolveOptimisticState(false, "state-2", "state-1")).toBe("state-1");
  });
});
