import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerUnblockedDependencies } from "../dependency-automation";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import { logActivity } from "@/lib/activity-logger";
import { claimUnblockAnnouncement } from "@/lib/unblock-dedup";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskRelation: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/actions/notification", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/activity-logger", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/unblock-dedup", () => ({
  claimUnblockAnnouncement: vi.fn().mockResolvedValue(true),
}));

describe("triggerUnblockedDependencies — Bağımlılık Çözülme Otomasyonu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(claimUnblockAnnouncement).mockResolvedValue(true);
  });

  it("tamamlanan görevin bloke ettiği hiçbir görev yoksa hiçbir işlem yapmaz", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(prisma.taskRelation.findMany).toHaveBeenCalledTimes(1);
    expect(claimUnblockAnnouncement).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("hedef görevin tek engelleyicisi tamamlandığında TASK_UNBLOCKED aktivitesi yazar ve atananlara bildirim gönderir", async () => {
    // 1. sorgu: completedTaskId'nin engellediği ilişkiler
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        createdAt: new Date(),
        targetTask: {
          id: "task-uygar",
          title: "Dashboard Geliştir",
          state: { id: "st-todo", group: "TODO", name: "Yapılacak" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    // 2. sorgu: task-uygar'ın tüm gelen engelleyicileri (yalnızca task-ozlem var ve o da artık DONE)
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        createdAt: new Date(),
        sourceTask: {
          id: "task-ozlem",
          title: "Debug Görevi",
          state: { id: "st-done", group: "DONE", name: "Tamamlandı" },
        },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(claimUnblockAnnouncement).toHaveBeenCalledTimes(1);
    expect(claimUnblockAnnouncement).toHaveBeenCalledWith("task-uygar", "user-ozlem");

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith({
      type: "TASK_UNBLOCKED",
      title: "Görev engeli kalktı",
      message: "'Debug Görevi' tamamlandı. 'Dashboard Geliştir' görevinin aktif engeli kalmadı.",
      link: "/projects/prj-1/board?task=task-uygar",
      actorId: "user-ozlem",
      userId: "user-uygar",
    });
  });

  it("hedef görevin birden fazla engelleyicisi varsa ve hepsi DONE ise bildirim gönderir", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        createdAt: new Date(),
        targetTask: {
          id: "task-uygar",
          title: "Dashboard Geliştir",
          state: { id: "st-in-prog", group: "IN_PROGRESS", name: "Devam Ediyor" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    // task-uygar'ın 2 engelleyicisi var, ikisi de DONE
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
      {
        id: "rel-2",
        sourceTaskId: "task-can",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(claimUnblockAnnouncement).toHaveBeenCalledTimes(1);
    expect(claimUnblockAnnouncement).toHaveBeenCalledWith("task-uygar", "user-ozlem");
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("hedef görevin diğer engelleyicisi hâlâ IN_PROGRESS ise aktivite yazmaz ve bildirim göndermez (sessiz koruma)", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        targetTask: {
          id: "task-uygar",
          title: "Dashboard Geliştir",
          state: { id: "st-todo", group: "TODO" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    // task-ozlem DONE ama task-can hâlâ IN_PROGRESS
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
      {
        id: "rel-2",
        sourceTaskId: "task-can",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "IN_PROGRESS" } },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(logActivity).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("hedef görevin diğer engelleyicisi TODO grubunda ise bildirim göndermez", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        targetTask: {
          id: "task-uygar",
          title: "Dashboard Geliştir",
          state: { id: "st-todo", group: "TODO" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
      {
        id: "rel-2",
        sourceTaskId: "task-can",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "TODO" } },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(logActivity).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("hedef görev zaten DONE durumundaysa işlemi atlar", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        targetTask: {
          id: "task-uygar",
          title: "Zaten Biten Görev",
          state: { id: "st-done", group: "DONE" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    // incomingBlockers sorgusu bile çalıştırılmamalı
    expect(prisma.taskRelation.findMany).toHaveBeenCalledTimes(1);
    expect(logActivity).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("hedef görev CANCELLED durumundaysa işlemi atlar", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        targetTask: {
          id: "task-uygar",
          title: "İptal Edilmiş Görev",
          state: { id: "st-canc", group: "CANCELLED" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(prisma.taskRelation.findMany).toHaveBeenCalledTimes(1);
    expect(logActivity).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("görevi tamamlayan kullanıcı hedef görevin de tek atananı ise self-notification engellenir", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem-1",
        targetTaskId: "task-ozlem-2",
        type: "BLOCKS",
        targetTask: {
          id: "task-ozlem-2",
          title: "Özlem İkinci Görev",
          state: { id: "st-todo", group: "TODO" },
          assignees: [{ taskId: "task-ozlem-2", userId: "user-ozlem" }], // Aktörün kendisi
        },
      } as any,
    ]);

    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem-1",
        targetTaskId: "task-ozlem-2",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem-1", "Özlem Birinci", "prj-1", "user-ozlem");

    // Dedup üzerinden unblock talep edilir
    expect(claimUnblockAnnouncement).toHaveBeenCalledWith("task-ozlem-2", "user-ozlem");

    // Ancak kendine bildirim gönderilmez
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("hedef görevin birden fazla atananı varsa ve biri aktör ise sadece diğer atananlara bildirim gider", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-pair",
        type: "BLOCKS",
        targetTask: {
          id: "task-pair",
          title: "Ortak Görev",
          state: { id: "st-todo", group: "TODO" },
          assignees: [
            { taskId: "task-pair", userId: "user-ozlem" },
            { taskId: "task-pair", userId: "user-uygar" },
          ],
        },
      } as any,
    ]);

    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-pair",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-uygar",
      }),
    );
  });

  it("hedef görevin hiç atananı yoksa aktivite yazar ama bildirim göndermez", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-unassigned",
        type: "BLOCKS",
        targetTask: {
          id: "task-unassigned",
          title: "Sahipsiz Görev",
          state: { id: "st-todo", group: "TODO" },
          assignees: [],
        },
      } as any,
    ]);

    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-unassigned",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(claimUnblockAnnouncement).toHaveBeenCalledTimes(1);
    expect(claimUnblockAnnouncement).toHaveBeenCalledWith("task-unassigned", "user-ozlem");
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("aynı hedef göreve giden birden fazla ilişki varsa tekilleştirir ve tek aktivite/bildirim üretir", async () => {
    // Veritabanında yinelenen ya da çoklu kayıt senaryosu
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        targetTask: {
          id: "task-uygar",
          title: "Dashboard Geliştir",
          state: { id: "st-todo", group: "TODO" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
      {
        id: "rel-1-duplicate",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        targetTask: {
          id: "task-uygar",
          title: "Dashboard Geliştir",
          state: { id: "st-todo", group: "TODO" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
    ]);

    await triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem");

    expect(claimUnblockAnnouncement).toHaveBeenCalledTimes(1);
    expect(claimUnblockAnnouncement).toHaveBeenCalledWith("task-uygar", "user-ozlem");
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("veritabanı sorgusu hata fırlattığında hatayı yakalar ve dışarı sızdırmaz (resilience)", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockRejectedValueOnce(
      new Error("Veritabanı bağlantı hatası"),
    );

    // Hata fırlatmamalıdır
    await expect(
      triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem"),
    ).resolves.not.toThrow();

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("createNotification hata fırlattığında akış kesilmez ve hata yutulur", async () => {
    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        targetTask: {
          id: "task-uygar",
          title: "Dashboard Geliştir",
          state: { id: "st-todo", group: "TODO" },
          assignees: [{ taskId: "task-uygar", userId: "user-uygar" }],
        },
      } as any,
    ]);

    vi.mocked(prisma.taskRelation.findMany).mockResolvedValueOnce([
      {
        id: "rel-1",
        sourceTaskId: "task-ozlem",
        targetTaskId: "task-uygar",
        type: "BLOCKS",
        sourceTask: { state: { group: "DONE" } },
      } as any,
    ]);

    vi.mocked(createNotification).mockRejectedValueOnce(new Error("Notification tablosu kilitli"));

    await expect(
      triggerUnblockedDependencies("task-ozlem", "Debug Görevi", "prj-1", "user-ozlem"),
    ).resolves.not.toThrow();
  });
});
