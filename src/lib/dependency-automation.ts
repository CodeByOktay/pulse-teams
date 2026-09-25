import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import {
  filterSelfNotifications,
  formatUnblockedNotificationMessage,
  isTaskFullyUnblocked,
  type BlockerState,
} from "@/lib/automation-logic";
import { buildNotificationDeepLink } from "@/lib/notification-logic";
import { createNotification } from "@/actions/notification";

/**
 * Bir görev DONE olduğunda, onun engellediği görevleri değerlendirir; artık hiçbir aktif
 * engeli kalmayanlar için TASK_UNBLOCKED aktivitesi yazar ve atanan kişilere bildirim gönderir.
 *
 * Bu fonksiyon bilinçli olarak "use server" dosyasında DEĞİLDİR: istemci tarafından doğrudan
 * çağrılabilir bir endpoint olmamalı (actorId sahteciliği riski). Yalnızca sunucu action'ları
 * tarafından, oturumdan doğrulanmış actorId ile çağrılır.
 *
 * Dayanıklılık: tüm gövde try/catch içindedir; hata asıl mutasyonu asla etkilemez.
 */
export async function triggerUnblockedDependencies(
  completedTaskId: string,
  completedTaskTitle: string,
  projectId: string,
  actorId: string,
): Promise<void> {
  try {
    const outgoingRelations = await prisma.taskRelation.findMany({
      where: { sourceTaskId: completedTaskId, type: "BLOCKS" },
      include: {
        targetTask: {
          include: { assignees: true, state: true },
        },
      },
    });

    // Aynı hedef birden fazla satırla gelmesin; zaten kapalı (DONE/CANCELLED) hedefleri atla.
    const dependents = new Map<string, (typeof outgoingRelations)[number]["targetTask"]>();
    for (const relation of outgoingRelations) {
      const group = relation.targetTask.state.group;
      if (group === "DONE" || group === "CANCELLED") continue;
      dependents.set(relation.targetTaskId, relation.targetTask);
    }

    if (dependents.size === 0) return;

    // Tüm hedeflerin gelen engelleyicilerini tek sorguda çek (N+1 yok).
    const incomingBlockers = await prisma.taskRelation.findMany({
      where: { targetTaskId: { in: [...dependents.keys()] }, type: "BLOCKS" },
      include: { sourceTask: { include: { state: true } } },
    });

    const blockersByTarget = new Map<string, BlockerState[]>();
    for (const relation of incomingBlockers) {
      const list = blockersByTarget.get(relation.targetTaskId) ?? [];
      list.push({
        taskId: relation.sourceTaskId,
        stateGroup: relation.sourceTask.state.group,
      });
      blockersByTarget.set(relation.targetTaskId, list);
    }

    for (const [targetTaskId, targetTask] of dependents) {
      const blockerStates = blockersByTarget.get(targetTaskId) ?? [];
      if (!isTaskFullyUnblocked(blockerStates)) continue;

      await logActivity(prisma, {
        type: "TASK_UNBLOCKED",
        taskId: targetTaskId,
        actorId,
      });

      const assigneeIds = targetTask.assignees.map((a) => a.userId);
      const recipientIds = filterSelfNotifications(assigneeIds, actorId);
      if (recipientIds.length === 0) continue;

      const notif = formatUnblockedNotificationMessage(completedTaskTitle, targetTask.title);
      const link = buildNotificationDeepLink(projectId, targetTaskId);

      for (const recipientId of recipientIds) {
        await createNotification({
          type: "TASK_UNBLOCKED",
          title: notif.title,
          message: notif.message,
          link,
          actorId,
          userId: recipientId,
        });
      }
    }
  } catch (err) {
    console.error("Dependency automation error:", err);
  }
}
