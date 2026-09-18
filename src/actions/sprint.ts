"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SprintStatus } from "@prisma/client";

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
}

export type CreateSprintInput = {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: Date | null;
  endDate?: Date | null;
};

export async function createSprint(input: CreateSprintInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  await requireMembership(input.projectId, session.user.id);

  if (!input.name.trim()) {
    throw new Error("Sprint adı zorunludur.");
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: { projectId: input.projectId, status: "ACTIVE" },
  });

  if (activeSprint) {
    throw new Error("Bu projede zaten aktif bir sprint var.");
  }

  const sprint = await prisma.sprint.create({
    data: {
      name: input.name.trim(),
      goal: input.goal,
      startDate: input.startDate ?? undefined,
      endDate: input.endDate ?? undefined,
      projectId: input.projectId,
    },
  });

  revalidatePath(`/projects/${input.projectId}/sprints`);

  return sprint;
}

export type UpdateSprintInput = Partial<{
  name: string;
  goal: string;
  startDate: Date | null;
  endDate: Date | null;
  status: SprintStatus;
}>;

export async function updateSprint(sprintId: string, data: UpdateSprintInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const existingSprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!existingSprint) {
    throw new Error("Sprint bulunamadı.");
  }

  await requireMembership(existingSprint.projectId, session.user.id);

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.goal !== undefined) updateData.goal = data.goal;
  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;
  if (data.status !== undefined) updateData.status = data.status;

  const sprint = await prisma.sprint.update({
    where: { id: sprintId },
    data: updateData,
  });

  revalidatePath(`/projects/${existingSprint.projectId}/sprints`);

  return sprint;
}

export async function deleteSprint(sprintId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const existingSprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!existingSprint) {
    throw new Error("Sprint bulunamadı.");
  }

  await requireMembership(existingSprint.projectId, session.user.id);

  if (existingSprint.status !== "DRAFT") {
    throw new Error("Sadece taslak sprintler silinebilir.");
  }

  await prisma.sprint.delete({ where: { id: sprintId } });

  revalidatePath(`/projects/${existingSprint.projectId}/sprints`);
}

export async function addTaskToSprint(sprintId: string, taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    throw new Error("Sprint bulunamadı.");
  }

  await requireMembership(sprint.projectId, session.user.id);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  if (task.projectId !== sprint.projectId) {
    throw new Error("Görev bu projeye ait değil.");
  }

  const existingLink = await prisma.sprintTask.findUnique({
    where: { sprintId_taskId: { sprintId, taskId } },
  });

  if (!existingLink) {
    await prisma.sprintTask.create({ data: { sprintId, taskId } });
  }

  revalidatePath(`/projects/${sprint.projectId}/sprints`);
}

export async function removeTaskFromSprint(sprintId: string, taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    throw new Error("Sprint bulunamadı.");
  }

  await requireMembership(sprint.projectId, session.user.id);

  await prisma.sprintTask.delete({
    where: { sprintId_taskId: { sprintId, taskId } },
  });

  revalidatePath(`/projects/${sprint.projectId}/sprints`);
}

export async function startSprint(sprintId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    throw new Error("Sprint bulunamadı.");
  }

  await requireMembership(sprint.projectId, session.user.id);

  const activeSprint = await prisma.sprint.findFirst({
    where: { projectId: sprint.projectId, status: "ACTIVE" },
  });

  if (activeSprint) {
    throw new Error("Bu projede zaten aktif bir sprint var.");
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      status: "ACTIVE",
      startDate: sprint.startDate ?? new Date(),
    },
  });

  revalidatePath(`/projects/${sprint.projectId}/sprints`);

  return updated;
}

export async function completeSprint(sprintId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    throw new Error("Sprint bulunamadı.");
  }

  await requireMembership(sprint.projectId, session.user.id);

  if (sprint.status !== "ACTIVE") {
    throw new Error("Sadece aktif sprintler tamamlanabilir.");
  }

  const incompleteCount = await prisma.sprintTask.count({
    where: {
      sprintId,
      task: {
        state: {
          group: { notIn: ["DONE", "CANCELLED"] },
        },
      },
    },
  });

  await prisma.sprint.update({
    where: { id: sprintId },
    data: { status: "COMPLETED" },
  });

  revalidatePath(`/projects/${sprint.projectId}/sprints`);

  return incompleteCount;
}
