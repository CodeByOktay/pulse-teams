"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, requireMembership } from "@/lib/authz";
import { getNextSequenceId } from "@/lib/sequence";
import { logActivity, type PrismaTransactionClient } from "@/lib/activity-logger";
import { isCompletionTransition } from "@/lib/automation-logic";
import { triggerUnblockedDependencies } from "@/lib/dependency-automation";
import { upsertTaskEmbedding } from "@/lib/embedding-service";
import { emitDomainEvent } from "@/lib/domain-events";
import type { Prisma, Priority } from "@prisma/client";

const PRIORITY_LABEL_TR: Record<Priority, string> = {
  NONE: "Yok",
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  URGENT: "Acil",
};

const relatedTaskSelect = {
  id: true,
  sequenceId: true,
  title: true,
  state: { select: { name: true, color: true } },
  project: { select: { identifier: true } },
} satisfies Prisma.TaskSelect;

function dateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toLocaleDateString("tr-TR");
}

function datesDiffer(a: Date | null, b: Date | null | undefined): boolean {
  if (b === undefined) return false;
  const aTime = a ? a.getTime() : null;
  const bTime = b ? b.getTime() : null;
  return aTime !== bTime;
}

async function nextSortOrder(tx: PrismaTransactionClient, stateId: string): Promise<number> {
  const lastTask = await tx.task.findFirst({
    where: { stateId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return lastTask ? lastTask.sortOrder + 10000 : 65535;
}

async function resolveDefaultStateId(projectId: string): Promise<string> {
  const defaultState = await prisma.state.findFirst({
    where: { projectId, isDefault: true },
    select: { id: true },
  });
  if (!defaultState) {
    throw new Error("Projede varsayılan bir state bulunamadı.");
  }

  return defaultState.id;
}

const STATE_NOT_IN_PROJECT_MESSAGE = "Seçilen durum bu projeye ait değil.";
const ASSIGNEE_NOT_IN_PROJECT_MESSAGE = "Atanan kullanıcılar bu projenin üyesi olmalıdır.";

/** Cross-project bütünlük: state gerçekten bu projeye ait olmalı. Transaction öncesi çağrılır. */
async function requireStateInProject(stateId: string, projectId: string) {
  const state = await prisma.state.findFirst({
    where: { id: stateId, projectId },
    select: { name: true, group: true },
  });
  if (!state) {
    throw new Error(STATE_NOT_IN_PROJECT_MESSAGE);
  }

  return state;
}

/** Cross-project bütünlük: tüm kullanıcılar bu projenin üyesi olmalı (tekilleştirilmiş sayım). */
async function requireUsersInProject(userIds: string[], projectId: string) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;

  const memberCount = await prisma.projectMember.count({
    where: { projectId, userId: { in: uniqueIds } },
  });
  if (memberCount !== uniqueIds.length) {
    throw new Error(ASSIGNEE_NOT_IN_PROJECT_MESSAGE);
  }
}

export type CreateTaskInput = {
  projectId: string;
  title: string;
  stateId?: string;
  priority?: Priority;
  description?: string;
  startDate?: Date | null;
  dueDate?: Date | null;
};

export async function createTask(input: CreateTaskInput) {
  const userId = await requireUserId();

  await requireMembership(input.projectId, userId);

  if (!input.title.trim()) {
    throw new Error("Görev başlığı zorunludur.");
  }

  if (input.stateId) {
    await requireStateInProject(input.stateId, input.projectId);
  }

  const stateId = input.stateId || (await resolveDefaultStateId(input.projectId));

  const task = await prisma.$transaction(async (tx) => {
    const sequenceId = await getNextSequenceId(input.projectId, tx);
    const sortOrder = await nextSortOrder(tx, stateId);

    const created = await tx.task.create({
      data: {
        title: input.title.trim(),
        description: input.description,
        priority: input.priority ?? "NONE",
        startDate: input.startDate ?? undefined,
        dueDate: input.dueDate ?? undefined,
        projectId: input.projectId,
        stateId,
        sequenceId,
        sortOrder,
      },
    });

    await logActivity(tx, {
      type: "TASK_CREATED",
      taskId: created.id,
      actorId: userId,
    });

    await emitDomainEvent(tx, "TASK_CREATED", {
      projectId: input.projectId,
      taskId: created.id,
      actorId: userId,
    });

    return created;
  });

  await upsertTaskEmbedding(task.id);

  revalidatePath(`/projects/${input.projectId}/board`);

  return task;
}

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  priority?: Priority;
  stateId?: string;
  startDate?: Date | null;
  dueDate?: Date | null;
};

export async function updateTask(taskId: string, data: UpdateTaskInput) {
  const actorId = await requireUserId();

  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: { state: { select: { name: true, group: true } } },
  });
  if (!existingTask) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(existingTask.projectId, actorId);

  const newStateId =
    data.stateId !== undefined && data.stateId !== existingTask.stateId ? data.stateId : null;
  const newState =
    newStateId !== null ? await requireStateInProject(newStateId, existingTask.projectId) : null;
  const isCompleted =
    newState !== null && isCompletionTransition(existingTask.state.group, newState.group);

  const task = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

    if (newStateId !== null) {
      updateData.stateId = newStateId;
      updateData.sortOrder = await nextSortOrder(tx, newStateId);
    }

    const updated = await tx.task.update({
      where: { id: taskId },
      data: updateData,
    });

    if (data.title !== undefined && updated.title !== existingTask.title) {
      await logActivity(tx, {
        type: "TASK_TITLE_UPDATED",
        taskId,
        actorId,
        oldValue: existingTask.title,
        newValue: updated.title,
      });
    }

    if (data.description !== undefined && data.description !== existingTask.description) {
      await logActivity(tx, {
        type: "TASK_DESCRIPTION_UPDATED",
        taskId,
        actorId,
        oldValue: existingTask.description,
        newValue: data.description,
      });
    }

    if (newState !== null) {
      await logActivity(tx, {
        type: "TASK_STATE_CHANGED",
        taskId,
        actorId,
        oldValue: existingTask.state.name,
        newValue: newState.name,
      });

      await emitDomainEvent(tx, "TASK_STATE_CHANGED", {
        projectId: existingTask.projectId,
        taskId,
        oldValue: existingTask.stateId,
        newValue: newStateId,
        actorId,
      });
    }

    if (isCompleted) {
      await logActivity(tx, {
        type: "TASK_COMPLETED",
        taskId,
        actorId,
      });

      await emitDomainEvent(tx, "TASK_COMPLETED", {
        projectId: existingTask.projectId,
        taskId,
        actorId,
      });
    }

    if (data.priority !== undefined && data.priority !== existingTask.priority) {
      await logActivity(tx, {
        type: "TASK_PRIORITY_CHANGED",
        taskId,
        actorId,
        oldValue: PRIORITY_LABEL_TR[existingTask.priority],
        newValue: PRIORITY_LABEL_TR[data.priority],
      });
    }

    if (datesDiffer(existingTask.dueDate, data.dueDate)) {
      await logActivity(tx, {
        type: "TASK_DUE_DATE_CHANGED",
        taskId,
        actorId,
        oldValue: dateOnly(existingTask.dueDate),
        newValue: dateOnly(data.dueDate),
      });
    }

    if (datesDiffer(existingTask.startDate, data.startDate)) {
      await logActivity(tx, {
        type: "TASK_START_DATE_CHANGED",
        taskId,
        actorId,
        oldValue: dateOnly(existingTask.startDate),
        newValue: dateOnly(data.startDate),
      });
    }

    return updated;
  });

  // Transaction sonrası otomasyon: hata yakalama fonksiyonun içinde, updateTask'ı etkilemez.
  if (isCompleted) {
    await triggerUnblockedDependencies(taskId, task.title, existingTask.projectId, actorId);
  }

  if (data.title !== undefined || data.description !== undefined) {
    await upsertTaskEmbedding(taskId);
  }

  revalidatePath(`/projects/${existingTask.projectId}/board`);

  return task;
}

export async function deleteTask(taskId: string) {
  const userId = await requireUserId();

  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!existingTask) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(existingTask.projectId, userId);

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath(`/projects/${existingTask.projectId}/board`);
}

export async function getTaskDetail(taskId: string) {
  const userId = await requireUserId();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, identifier: true, name: true } },
      labels: { include: { label: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
      sprints: { include: { sprint: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
      sourceRelations: {
        orderBy: { createdAt: "asc" },
        include: { targetTask: { select: relatedTaskSelect } },
      },
      targetRelations: {
        orderBy: { createdAt: "asc" },
        include: { sourceTask: { select: relatedTaskSelect } },
      },
    },
  });

  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, userId);

  return task;
}

export type BulkUpdateTasksInput = {
  stateId?: string;
  priority?: Priority;
  assigneeId?: string;
};

function assertBulkTaskCount(
  taskIds: string[],
  limit: number,
  verb: "güncellenebilir" | "silinebilir",
) {
  if (taskIds.length === 0) {
    throw new Error("En az bir görev seçilmelidir.");
  }

  if (taskIds.length > limit) {
    throw new Error(`Aynı anda en fazla ${limit} görev ${verb}.`);
  }
}

async function requireSameProjectTasks(taskIds: string[], userId: string) {
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, projectId: true },
  });

  if (tasks.length !== taskIds.length) {
    throw new Error("Bazı görevler bulunamadı.");
  }

  const projectIds = new Set(tasks.map((t) => t.projectId));
  if (projectIds.size > 1) {
    throw new Error("Seçili görevler aynı projeye ait olmalıdır.");
  }

  const [projectId] = projectIds;
  await requireMembership(projectId, userId);

  return projectId;
}

export async function bulkUpdateTasks(taskIds: string[], data: BulkUpdateTasksInput) {
  const userId = await requireUserId();

  assertBulkTaskCount(taskIds, 100, "güncellenebilir");

  const projectId = await requireSameProjectTasks(taskIds, userId);

  const { stateId, priority, assigneeId } = data;

  // Cross-project bütünlük doğrulamaları transaction açılmadan önce yapılır.
  let newState: { name: string; group: string } | null = null;
  let previousTaskStates: Map<string, { stateId: string; name: string; group: string }> = new Map();
  if (stateId !== undefined) {
    newState = await requireStateInProject(stateId, projectId);

    const currentTasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, stateId: true, state: { select: { name: true, group: true } } },
    });
    previousTaskStates = new Map(
      currentTasks.map((t) => [t.id, { stateId: t.stateId, name: t.state.name, group: t.state.group }]),
    );
  }
  if (assigneeId !== undefined) {
    await requireUsersInProject([assigneeId], projectId);
  }

  await prisma.$transaction(async (tx) => {
    if (stateId !== undefined || priority !== undefined) {
      await tx.task.updateMany({
        where: { id: { in: taskIds } },
        data: { stateId, priority },
      });
    }

    if (stateId !== undefined && newState) {
      for (const taskId of taskIds) {
        const previous = previousTaskStates.get(taskId);
        if (!previous || previous.stateId === stateId) continue;

        await logActivity(tx, {
          type: "TASK_STATE_CHANGED",
          taskId,
          actorId: userId,
          oldValue: previous.name,
          newValue: newState.name,
        });

        await emitDomainEvent(tx, "TASK_STATE_CHANGED", {
          projectId,
          taskId,
          oldValue: previous.stateId,
          newValue: stateId,
          actorId: userId,
        });

        if (isCompletionTransition(previous.group, newState.group)) {
          await emitDomainEvent(tx, "TASK_COMPLETED", {
            projectId,
            taskId,
            actorId: userId,
          });
        }
      }
    }

    if (assigneeId !== undefined) {
      await tx.taskAssignee.createMany({
        data: taskIds.map((taskId) => ({ taskId, userId: assigneeId })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/board`);

  return { updatedCount: taskIds.length };
}

export async function bulkDeleteTasks(taskIds: string[]) {
  const userId = await requireUserId();

  assertBulkTaskCount(taskIds, 50, "silinebilir");

  const projectId = await requireSameProjectTasks(taskIds, userId);

  const { count } = await prisma.task.deleteMany({ where: { id: { in: taskIds } } });

  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/board`);

  return { deletedCount: count };
}

export async function reorderTask(taskId: string, newStateId: string, newSortOrder: number) {
  const userId = await requireUserId();

  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, stateId: true, state: { select: { name: true, group: true } } },
  });
  if (!existingTask) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(existingTask.projectId, userId);
  await requireStateInProject(newStateId, existingTask.projectId);

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { stateId: newStateId, sortOrder: newSortOrder },
    include: { state: true },
  });

  // Sütun içi yeniden sıralama da reorderTask üzerinden geçer; state gerçekten
  // değişmediyse ne aktivite ne DomainEvent yayınlanmaz.
  if (existingTask.stateId !== newStateId) {
    await logActivity(prisma, {
      type: "TASK_STATE_CHANGED",
      taskId,
      actorId: userId,
      oldValue: existingTask.state.name,
      newValue: task.state.name,
    });

    await emitDomainEvent(prisma, "TASK_STATE_CHANGED", {
      projectId: existingTask.projectId,
      taskId,
      oldValue: existingTask.stateId,
      newValue: newStateId,
      actorId: userId,
    });
  }

  // Kanban'da kartı DONE sütununa sürüklemek de bir tamamlanma geçişidir.
  if (isCompletionTransition(existingTask.state.group, task.state.group)) {
    await logActivity(prisma, {
      type: "TASK_COMPLETED",
      taskId,
      actorId: userId,
    });
    await emitDomainEvent(prisma, "TASK_COMPLETED", {
      projectId: existingTask.projectId,
      taskId,
      actorId: userId,
    });
    await triggerUnblockedDependencies(taskId, task.title, existingTask.projectId, userId);
  }

  revalidatePath(`/projects/${existingTask.projectId}/board`);

  return task;
}
