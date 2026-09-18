"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextSequenceId } from "@/lib/sequence";
import { logActivity } from "@/lib/activity-logger";
import type { Priority } from "@prisma/client";

const PRIORITY_LABEL_TR: Record<Priority, string> = {
  NONE: "Yok",
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  URGENT: "Acil",
};

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

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  await requireMembership(input.projectId, session.user.id);

  if (!input.title.trim()) {
    throw new Error("Görev başlığı zorunludur.");
  }

  const task = await prisma.$transaction(async (tx) => {
    let stateId = input.stateId;

    if (!stateId) {
      const defaultState = await tx.state.findFirst({
        where: { projectId: input.projectId, isDefault: true },
      });
      if (!defaultState) {
        throw new Error("Projede varsayılan bir state bulunamadı.");
      }
      stateId = defaultState.id;
    }

    const sequenceId = await getNextSequenceId(input.projectId, tx);

    const lastTask = await tx.task.findFirst({
      where: { stateId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const sortOrder = lastTask ? lastTask.sortOrder + 10000 : 65535;

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
      actorId: session.user.id,
    });

    return created;
  });

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: { state: true },
  });
  if (!existingTask) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(existingTask.projectId, session.user.id);

  const actorId = session.user.id;

  const task = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

    let newStateName: string | null = null;
    if (data.stateId !== undefined && data.stateId !== existingTask.stateId) {
      const lastTask = await tx.task.findFirst({
        where: { stateId: data.stateId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      updateData.stateId = data.stateId;
      updateData.sortOrder = lastTask ? lastTask.sortOrder + 10000 : 65535;

      const newState = await tx.state.findUnique({ where: { id: data.stateId } });
      newStateName = newState?.name ?? null;
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

    if (newStateName !== null) {
      await logActivity(tx, {
        type: "TASK_STATE_CHANGED",
        taskId,
        actorId,
        oldValue: existingTask.state.name,
        newValue: newStateName,
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

  revalidatePath(`/projects/${existingTask.projectId}/board`);

  return task;
}

export async function deleteTask(taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existingTask) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(existingTask.projectId, session.user.id);

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath(`/projects/${existingTask.projectId}/board`);
}

export async function getTaskDetail(taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, identifier: true } },
      labels: { include: { label: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  return task;
}

export type BulkUpdateTasksInput = {
  stateId?: string;
  priority?: Priority;
  assigneeId?: string;
};

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  if (taskIds.length === 0) {
    throw new Error("En az bir görev seçilmelidir.");
  }

  if (taskIds.length > 100) {
    throw new Error("Aynı anda en fazla 100 görev güncellenebilir.");
  }

  const projectId = await requireSameProjectTasks(taskIds, session.user.id);

  await prisma.$transaction(async (tx) => {
    if (data.stateId !== undefined) {
      await tx.task.updateMany({
        where: { id: { in: taskIds } },
        data: { stateId: data.stateId },
      });
    }

    if (data.priority !== undefined) {
      await tx.task.updateMany({
        where: { id: { in: taskIds } },
        data: { priority: data.priority },
      });
    }

    if (data.assigneeId !== undefined) {
      await tx.taskAssignee.createMany({
        data: taskIds.map((taskId) => ({ taskId, userId: data.assigneeId as string })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/board`);

  return { updatedCount: taskIds.length };
}

export async function bulkDeleteTasks(taskIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  if (taskIds.length === 0) {
    throw new Error("En az bir görev seçilmelidir.");
  }

  if (taskIds.length > 50) {
    throw new Error("Aynı anda en fazla 50 görev silinebilir.");
  }

  const projectId = await requireSameProjectTasks(taskIds, session.user.id);

  const { count } = await prisma.task.deleteMany({ where: { id: { in: taskIds } } });

  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/board`);

  return { deletedCount: count };
}

export async function reorderTask(taskId: string, newStateId: string, newSortOrder: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existingTask) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(existingTask.projectId, session.user.id);

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { stateId: newStateId, sortOrder: newSortOrder },
  });

  revalidatePath(`/projects/${existingTask.projectId}/board`);

  return task;
}
