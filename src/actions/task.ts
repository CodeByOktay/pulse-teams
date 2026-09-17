"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextSequenceId } from "@/lib/sequence";
import type { Priority } from "@prisma/client";

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

    return tx.task.create({
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

  const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existingTask) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(existingTask.projectId, session.user.id);

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

  if (data.stateId !== undefined && data.stateId !== existingTask.stateId) {
    const lastTask = await prisma.task.findFirst({
      where: { stateId: data.stateId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    updateData.stateId = data.stateId;
    updateData.sortOrder = lastTask ? lastTask.sortOrder + 10000 : 65535;
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
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
