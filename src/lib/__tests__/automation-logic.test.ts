import { describe, it, expect } from "vitest";
import {
  isCompletionTransition,
  isReopeningTransition,
  isTaskFullyUnblocked,
  findNewlyUnblockedTasks,
  formatUnblockedNotificationMessage,
  filterSelfNotifications,
  type DependentTaskInput,
  type BlockerState,
} from "../automation-logic";

describe("automation-logic — isCompletionTransition", () => {
  it("TODO -> DONE geçişinde true döner", () => {
    expect(isCompletionTransition("TODO", "DONE")).toBe(true);
  });

  it("IN_PROGRESS -> DONE geçişinde true döner", () => {
    expect(isCompletionTransition("IN_PROGRESS", "DONE")).toBe(true);
  });

  it("BACKLOG -> DONE geçişinde true döner", () => {
    expect(isCompletionTransition("BACKLOG", "DONE")).toBe(true);
  });

  it("CANCELLED -> DONE geçişinde true döner", () => {
    expect(isCompletionTransition("CANCELLED", "DONE")).toBe(true);
  });

  it("eski durum tanımsız/null iken DONE'a geçişte true döner", () => {
    expect(isCompletionTransition(null, "DONE")).toBe(true);
    expect(isCompletionTransition(undefined, "DONE")).toBe(true);
  });

  it("DONE -> DONE (aynı grupta durum değişimi) durumunda false döner", () => {
    expect(isCompletionTransition("DONE", "DONE")).toBe(false);
  });

  it("IN_PROGRESS -> TODO gibi DONE dışı geçişlerde false döner", () => {
    expect(isCompletionTransition("IN_PROGRESS", "TODO")).toBe(false);
  });

  it("DONE -> IN_PROGRESS geçişinde false döner", () => {
    expect(isCompletionTransition("DONE", "IN_PROGRESS")).toBe(false);
  });
});

describe("automation-logic — isReopeningTransition", () => {
  it("DONE -> IN_PROGRESS geçişinde true döner (görev yeniden açıldı)", () => {
    expect(isReopeningTransition("DONE", "IN_PROGRESS")).toBe(true);
  });

  it("DONE -> TODO geçişinde true döner", () => {
    expect(isReopeningTransition("DONE", "TODO")).toBe(true);
  });

  it("DONE -> BACKLOG geçişinde true döner", () => {
    expect(isReopeningTransition("DONE", "BACKLOG")).toBe(true);
  });

  it("DONE -> DONE geçişinde false döner", () => {
    expect(isReopeningTransition("DONE", "DONE")).toBe(false);
  });

  it("TODO -> IN_PROGRESS gibi zaten açık olan görev geçişlerinde false döner", () => {
    expect(isReopeningTransition("TODO", "IN_PROGRESS")).toBe(false);
  });
});

describe("automation-logic — isTaskFullyUnblocked", () => {
  it("engelleyici listesi boş ise true döner (engeli yok)", () => {
    expect(isTaskFullyUnblocked([])).toBe(true);
  });

  it("tüm engelleyiciler DONE durumunda ise true döner", () => {
    const blockers: BlockerState[] = [
      { taskId: "task-1", stateGroup: "DONE" },
      { taskId: "task-2", stateGroup: "DONE" },
    ];
    expect(isTaskFullyUnblocked(blockers)).toBe(true);
  });

  it("en az bir engelleyici IN_PROGRESS ise false döner", () => {
    const blockers: BlockerState[] = [
      { taskId: "task-1", stateGroup: "DONE" },
      { taskId: "task-2", stateGroup: "IN_PROGRESS" },
    ];
    expect(isTaskFullyUnblocked(blockers)).toBe(false);
  });

  it("en az bir engelleyici TODO veya BACKLOG ise false döner", () => {
    const blockers: BlockerState[] = [
      { id: "task-1", stateGroup: "TODO" },
    ];
    expect(isTaskFullyUnblocked(blockers)).toBe(false);
  });
});

describe("automation-logic — findNewlyUnblockedTasks", () => {
  it("tek engelleyicisi tamamlanan görevi unblocked olarak tespit eder", () => {
    const dependentTasks: DependentTaskInput[] = [
      {
        id: "task-uygar",
        assigneeIds: ["user-uygar"],
        blockers: [{ taskId: "task-ozlem", stateGroup: "DONE" }],
      },
    ];

    const results = findNewlyUnblockedTasks({
      completedTaskId: "task-ozlem",
      dependentTasks,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      taskId: "task-uygar",
      recipientUserIds: ["user-uygar"],
    });
  });

  it("çoklu engelleyicisi olan bir görevin diğer engelleyicisi henüz bitmediyse listeye eklemez", () => {
    const dependentTasks: DependentTaskInput[] = [
      {
        id: "task-uygar",
        assigneeIds: ["user-uygar"],
        blockers: [
          { taskId: "task-ozlem", stateGroup: "DONE" },
          { taskId: "task-can", stateGroup: "IN_PROGRESS" }, // hâlâ aktif blocker
        ],
      },
    ];

    const results = findNewlyUnblockedTasks({
      completedTaskId: "task-ozlem",
      dependentTasks,
    });

    expect(results).toHaveLength(0);
  });

  it("çoklu engelleyicilerin tamamı DONE olduğunda görevi listeye dahil eder", () => {
    const dependentTasks: DependentTaskInput[] = [
      {
        id: "task-uygar",
        assigneeIds: ["user-uygar"],
        blockers: [
          { taskId: "task-ozlem", stateGroup: "DONE" },
          { taskId: "task-can", stateGroup: "DONE" },
        ],
      },
    ];

    const results = findNewlyUnblockedTasks({
      completedTaskId: "task-ozlem",
      dependentTasks,
    });

    expect(results).toHaveLength(1);
    expect(results[0].taskId).toBe("task-uygar");
    expect(results[0].recipientUserIds).toEqual(["user-uygar"]);
  });

  it("atananı olmayan bağımlı görev için boş recipientUserIds dizisi döner", () => {
    const dependentTasks: DependentTaskInput[] = [
      {
        id: "task-unassigned",
        assigneeIds: [],
        blockers: [{ taskId: "task-ozlem", stateGroup: "DONE" }],
      },
    ];

    const results = findNewlyUnblockedTasks({
      completedTaskId: "task-ozlem",
      dependentTasks,
    });

    expect(results).toHaveLength(1);
    expect(results[0].recipientUserIds).toEqual([]);
  });

  it("birden fazla atananı olan bağımlı görev için tüm atananları döner", () => {
    const dependentTasks: DependentTaskInput[] = [
      {
        id: "task-pair",
        assigneeIds: ["user-1", "user-2"],
        blockers: [{ taskId: "task-ozlem", stateGroup: "DONE" }],
      },
    ];

    const results = findNewlyUnblockedTasks({
      completedTaskId: "task-ozlem",
      dependentTasks,
    });

    expect(results[0].recipientUserIds).toEqual(["user-1", "user-2"]);
  });
});

describe("automation-logic — formatUnblockedNotificationMessage", () => {
  it("standart Türkçe bildirim başlığı ve mesaj metni üretir", () => {
    const { title, message } = formatUnblockedNotificationMessage(
      "Özlem Debug",
      "Uygar Dashboard",
    );

    expect(title).toBe("Görev engeli kalktı");
    expect(message).toBe(
      "'Özlem Debug' tamamlandı. 'Uygar Dashboard' görevinin aktif engeli kalmadı.",
    );
  });
});

describe("automation-logic — filterSelfNotifications", () => {
  it("kullanıcı kendi tamamladığı görev sebebiyle oluşan listeden kendini çıkarır", () => {
    const recipientIds = ["user-ozlem", "user-uygar"];
    const filtered = filterSelfNotifications(recipientIds, "user-ozlem");

    expect(filtered).toEqual(["user-uygar"]);
  });

  it("actorId alıcılar arasında değilse listeyi olduğu gibi korur", () => {
    const recipientIds = ["user-uygar", "user-can"];
    const filtered = filterSelfNotifications(recipientIds, "user-ozlem");

    expect(filtered).toEqual(["user-uygar", "user-can"]);
  });

  it("kullanıcı tek alıcı ise ve aynı zamanda actor ise boş dizi döner", () => {
    const recipientIds = ["user-ozlem"];
    const filtered = filterSelfNotifications(recipientIds, "user-ozlem");

    expect(filtered).toEqual([]);
  });
});
