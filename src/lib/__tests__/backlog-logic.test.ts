import { describe, it, expect } from "vitest";
import {
  isTaskInBacklog,
  canMoveTaskToSprint,
  canDeleteSprintTaskLink,
  getRemovableSprintIds,
  sortActiveDraftSprints,
} from "../backlog-logic";
import { getSprintProgress } from "../sprint-utils";

describe("isTaskInBacklog", () => {
  it("hiç sprint kaydı yoksa backlog'dadır", () => {
    expect(isTaskInBacklog([])).toBe(true);
  });

  it("sadece COMPLETED sprint kaydı varsa backlog'dadır", () => {
    expect(isTaskInBacklog(["COMPLETED"])).toBe(true);
  });

  it("birden fazla COMPLETED sprint kaydı varsa yine backlog'dadır", () => {
    expect(isTaskInBacklog(["COMPLETED", "COMPLETED"])).toBe(true);
  });

  it("ACTIVE sprinte bağlıysa backlog'da değildir", () => {
    expect(isTaskInBacklog(["ACTIVE"])).toBe(false);
  });

  it("DRAFT sprinte bağlıysa backlog'da değildir", () => {
    expect(isTaskInBacklog(["DRAFT"])).toBe(false);
  });

  it("COMPLETED ve ACTIVE karışıksa backlog'da değildir", () => {
    expect(isTaskInBacklog(["COMPLETED", "ACTIVE"])).toBe(false);
  });
});

describe("canMoveTaskToSprint", () => {
  it("sprint null ise izin verilmez", () => {
    const result = canMoveTaskToSprint(null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("sprint undefined ise izin verilmez", () => {
    expect(canMoveTaskToSprint(undefined).allowed).toBe(false);
  });

  it("COMPLETED sprinte taşımaya izin verilmez", () => {
    const result = canMoveTaskToSprint({ status: "COMPLETED" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Tamamlanmış bir sprinte görev eklenemez.");
  });

  it("ACTIVE sprinte taşımaya izin verilir", () => {
    expect(canMoveTaskToSprint({ status: "ACTIVE" }).allowed).toBe(true);
  });

  it("DRAFT sprinte taşımaya izin verilir", () => {
    expect(canMoveTaskToSprint({ status: "DRAFT" }).allowed).toBe(true);
  });
});

describe("canDeleteSprintTaskLink", () => {
  it("COMPLETED sprint bağlantısı silinemez", () => {
    expect(canDeleteSprintTaskLink("COMPLETED")).toBe(false);
  });

  it("ACTIVE sprint bağlantısı silinebilir", () => {
    expect(canDeleteSprintTaskLink("ACTIVE")).toBe(true);
  });

  it("DRAFT sprint bağlantısı silinebilir", () => {
    expect(canDeleteSprintTaskLink("DRAFT")).toBe(true);
  });
});

describe("getRemovableSprintIds", () => {
  it("boş listede boş dizi döner", () => {
    expect(getRemovableSprintIds([])).toEqual([]);
  });

  it("sadece ACTIVE/DRAFT sprint id'lerini döner, COMPLETED korunur", () => {
    const links = [
      { sprintId: "s1", sprint: { status: "ACTIVE" as const } },
      { sprintId: "s2", sprint: { status: "COMPLETED" as const } },
      { sprintId: "s3", sprint: { status: "DRAFT" as const } },
    ];
    expect(getRemovableSprintIds(links)).toEqual(["s1", "s3"]);
  });

  it("tüm bağlantılar COMPLETED ise boş dizi döner (geçmiş asla silinmez)", () => {
    const links = [
      { sprintId: "s1", sprint: { status: "COMPLETED" as const } },
      { sprintId: "s2", sprint: { status: "COMPLETED" as const } },
    ];
    expect(getRemovableSprintIds(links)).toEqual([]);
  });
});

describe("sortActiveDraftSprints", () => {
  it("COMPLETED sprintleri listeden çıkarır", () => {
    const sprints = [
      { id: "1", status: "COMPLETED" as const },
      { id: "2", status: "ACTIVE" as const },
    ];
    expect(sortActiveDraftSprints(sprints).map((s) => s.id)).toEqual(["2"]);
  });

  it("ACTIVE sprinti DRAFT sprintlerden önce sıralar", () => {
    const sprints = [
      { id: "draft-1", status: "DRAFT" as const },
      { id: "active-1", status: "ACTIVE" as const },
    ];
    expect(sortActiveDraftSprints(sprints).map((s) => s.id)).toEqual(["active-1", "draft-1"]);
  });

  it("boş listede boş dizi döner", () => {
    expect(sortActiveDraftSprints([])).toEqual([]);
  });
});

describe("getSprintProgress (backlog sprint kartları için)", () => {
  it("0 görevli sprintte division by zero engellenir, percentage 0 döner", () => {
    expect(getSprintProgress({ tasks: [] })).toEqual({ total: 0, completed: 0, percentage: 0 });
  });

  it("tüm görevler DONE ise percentage 100 döner", () => {
    const sprint = {
      tasks: [
        { task: { state: { group: "DONE" as const } } },
        { task: { state: { group: "DONE" as const } } },
      ],
    };
    expect(getSprintProgress(sprint).percentage).toBe(100);
  });

  it("ara yüzdelerde tam sayıya yuvarlar", () => {
    const sprint = {
      tasks: [
        { task: { state: { group: "DONE" as const } } },
        { task: { state: { group: "TODO" as const } } },
        { task: { state: { group: "TODO" as const } } },
      ],
    };
    expect(getSprintProgress(sprint).percentage).toBe(33);
  });
});
