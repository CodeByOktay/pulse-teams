import { describe, it, expect } from "vitest";
import { formatActivityMessage, type ActivityWithActor } from "../activity-logger";
import type { ActivityType } from "@prisma/client";

function makeActivity(overrides: Partial<ActivityWithActor> & { type: ActivityType }): ActivityWithActor {
  return {
    id: "act-1",
    taskId: "task-1",
    actorId: "user-1",
    oldValue: null,
    newValue: null,
    metadata: null,
    createdAt: new Date(2026, 0, 1),
    actor: { name: "Ali Veli" },
    ...overrides,
  };
}

describe("formatActivityMessage", () => {
  it("TASK_CREATED için doğru mesaj üretir", () => {
    const message = formatActivityMessage(makeActivity({ type: "TASK_CREATED" }));
    expect(message).toBe("Ali Veli görevi oluşturdu.");
  });

  it("TASK_STATE_CHANGED oldValue ve newValue'yu mesaja dahil eder", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_STATE_CHANGED", oldValue: "Backlog", newValue: "In Progress" }),
    );
    expect(message).toContain("Backlog");
    expect(message).toContain("In Progress");
  });

  it("TASK_TITLE_UPDATED oldValue ve newValue'yu mesaja dahil eder", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_TITLE_UPDATED", oldValue: "Eski başlık", newValue: "Yeni başlık" }),
    );
    expect(message).toContain("Eski başlık");
    expect(message).toContain("Yeni başlık");
  });

  it("TASK_ASSIGNEE_ADDED metadata.userName'i mesaja dahil eder", () => {
    const message = formatActivityMessage(
      makeActivity({
        type: "TASK_ASSIGNEE_ADDED",
        metadata: JSON.stringify({ userName: "Mehmet Yılmaz" }),
      }),
    );
    expect(message).toContain("Mehmet Yılmaz");
  });

  it("TASK_LABEL_ADDED metadata.labelName'i mesaja dahil eder", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_LABEL_ADDED", metadata: JSON.stringify({ labelName: "Bug" }) }),
    );
    expect(message).toContain("Bug");
  });

  it("TASK_LABEL_REMOVED metadata.labelName'i mesaja dahil eder", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_LABEL_REMOVED", metadata: JSON.stringify({ labelName: "Bug" }) }),
    );
    expect(message).toContain("Bug");
    expect(message).toContain("kaldırdı");
  });

  it("TASK_PRIORITY_CHANGED oldValue ve newValue'yu doğru gösterir", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_PRIORITY_CHANGED", oldValue: "Düşük", newValue: "Yüksek" }),
    );
    expect(message).toContain("Düşük");
    expect(message).toContain("Yüksek");
  });

  it("COMMENT_ADDED için doğru mesaj üretir", () => {
    const message = formatActivityMessage(makeActivity({ type: "COMMENT_ADDED" }));
    expect(message).toBe("Ali Veli yorum ekledi.");
  });

  it("COMMENT_DELETED için doğru mesaj üretir", () => {
    const message = formatActivityMessage(makeActivity({ type: "COMMENT_DELETED" }));
    expect(message).toBe("Ali Veli yorumu sildi.");
  });

  it("bilinmeyen type için hata fırlatmak yerine fallback mesaj döner", () => {
    const activity = makeActivity({ type: "UNKNOWN_TYPE" as ActivityType });
    expect(() => formatActivityMessage(activity)).not.toThrow();
    const message = formatActivityMessage(activity);
    expect(message).toContain("Ali Veli");
  });
});

describe("formatActivityMessage — boş değer edge case'leri", () => {
  it("oldValue null ise mesajda '—' kullanılır", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_STATE_CHANGED", oldValue: null, newValue: "Done" }),
    );
    expect(message).toContain("—");
  });

  it("actor.name null ise 'Bir kullanıcı' fallback kullanılır", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_CREATED", actor: { name: null } }),
    );
    expect(message).toBe("Bir kullanıcı görevi oluşturdu.");
  });

  it("actor null ise 'Bir kullanıcı' fallback kullanılır", () => {
    const message = formatActivityMessage(makeActivity({ type: "TASK_CREATED", actor: null }));
    expect(message).toBe("Bir kullanıcı görevi oluşturdu.");
  });

  it("metadata bozuk JSON ise hata fırlatmadan '—' döner", () => {
    const message = formatActivityMessage(
      makeActivity({ type: "TASK_ASSIGNEE_ADDED", metadata: "{invalid json" }),
    );
    expect(() =>
      formatActivityMessage(makeActivity({ type: "TASK_ASSIGNEE_ADDED", metadata: "{invalid json" })),
    ).not.toThrow();
    expect(message).toContain("—");
  });
});
