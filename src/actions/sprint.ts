"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteSprint, canStartSprint, validateSprintDates } from "@/lib/sprint-logic";
import { canMoveTaskToSprint, getRemovableSprintIds } from "@/lib/backlog-logic";
import { logActivity } from "@/lib/activity-logger";
import { createNotifications } from "@/actions/notification";
import { buildSprintNotificationDeepLink, shouldDeliverNotification } from "@/lib/notification-logic";
import type { Prisma, SprintStatus } from "@prisma/client";

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

  const dateValidation = validateSprintDates(input.startDate, input.endDate);
  if (!dateValidation.valid) {
    throw new Error(dateValidation.error);
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: { projectId: input.projectId, status: "ACTIVE" },
  });

  const startCheck = canStartSprint(Boolean(activeSprint));
  if (!startCheck.allowed) {
    throw new Error(startCheck.reason);
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

  const nextStartDate = data.startDate !== undefined ? data.startDate : existingSprint.startDate;
  const nextEndDate = data.endDate !== undefined ? data.endDate : existingSprint.endDate;
  const dateValidation = validateSprintDates(nextStartDate, nextEndDate);
  if (!dateValidation.valid) {
    throw new Error(dateValidation.error);
  }

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

  const deleteCheck = canDeleteSprint(existingSprint.status);
  if (!deleteCheck.allowed) {
    throw new Error(deleteCheck.reason);
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
    await prisma.$transaction(async (tx) => {
      await tx.sprintTask.create({ data: { sprintId, taskId } });
      await logActivity(tx, {
        type: "TASK_SPRINT_ADDED",
        taskId,
        actorId: session.user.id,
        metadata: { sprintName: sprint.name },
      });
    });
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

  await prisma.$transaction(async (tx) => {
    await tx.sprintTask.delete({
      where: { sprintId_taskId: { sprintId, taskId } },
    });
    await logActivity(tx, {
      type: "TASK_SPRINT_REMOVED",
      taskId,
      actorId: session.user.id,
      metadata: { sprintName: sprint.name },
    });
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

  const startCheck = canStartSprint(Boolean(activeSprint));
  if (!startCheck.allowed) {
    throw new Error(startCheck.reason);
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

  const members = await prisma.projectMember.findMany({
    where: { projectId: sprint.projectId },
    select: { userId: true },
  });

  const notificationEntries: Prisma.NotificationCreateManyInput[] = members
    .filter((member) => shouldDeliverNotification(session.user.id, member.userId))
    .map((member) => ({
      type: "SPRINT_COMPLETED",
      title: "Sprint tamamlandı",
      message: sprint.name,
      link: buildSprintNotificationDeepLink(sprint.projectId),
      actorId: session.user.id,
      userId: member.userId,
    }));

  await createNotifications(notificationEntries);

  revalidatePath(`/projects/${sprint.projectId}/sprints`);

  return incompleteCount;
}

export async function moveTaskToSprint(taskId: string, targetSprintId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const targetSprint = await prisma.sprint.findUnique({ where: { id: targetSprintId } });

  const moveCheck = canMoveTaskToSprint(targetSprint);
  if (!moveCheck.allowed || !targetSprint) {
    throw new Error(moveCheck.reason ?? "Sprint bulunamadı.");
  }

  await requireMembership(targetSprint.projectId, session.user.id);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  if (task.projectId !== targetSprint.projectId) {
    throw new Error("Görev bu projeye ait değil.");
  }

  const existingLinks = await prisma.sprintTask.findMany({
    where: { taskId },
    include: { sprint: { select: { status: true, name: true } } },
  });

  const removableSprintIds = getRemovableSprintIds(existingLinks).filter(
    (sprintId) => sprintId !== targetSprintId,
  );
  const previousSprintNames = existingLinks
    .filter((link) => removableSprintIds.includes(link.sprintId))
    .map((link) => link.sprint.name);
  const alreadyLinked = existingLinks.some((link) => link.sprintId === targetSprintId);

  await prisma.$transaction(async (tx) => {
    if (removableSprintIds.length > 0) {
      await tx.sprintTask.deleteMany({
        where: { taskId, sprintId: { in: removableSprintIds } },
      });
      for (const sprintName of previousSprintNames) {
        await logActivity(tx, {
          type: "TASK_SPRINT_REMOVED",
          taskId,
          actorId: session.user.id,
          metadata: { sprintName },
        });
      }
    }

    if (!alreadyLinked) {
      await tx.sprintTask.create({ data: { sprintId: targetSprintId, taskId } });
      await logActivity(tx, {
        type: "TASK_SPRINT_ADDED",
        taskId,
        actorId: session.user.id,
        metadata: { sprintName: targetSprint.name },
      });
    }
  });

  revalidatePath(`/projects/${targetSprint.projectId}/backlog`);
  revalidatePath(`/projects/${targetSprint.projectId}/sprints`);
  revalidatePath(`/projects/${targetSprint.projectId}/list`);
  revalidatePath(`/projects/${targetSprint.projectId}/board`);
}

export async function moveTaskToBacklog(taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  const existingLinks = await prisma.sprintTask.findMany({
    where: { taskId },
    include: { sprint: { select: { status: true, name: true } } },
  });

  const removableSprintIds = getRemovableSprintIds(existingLinks);
  if (removableSprintIds.length === 0) {
    return;
  }

  const removedSprintNames = existingLinks
    .filter((link) => removableSprintIds.includes(link.sprintId))
    .map((link) => link.sprint.name);

  await prisma.$transaction(async (tx) => {
    await tx.sprintTask.deleteMany({
      where: { taskId, sprintId: { in: removableSprintIds } },
    });
    for (const sprintName of removedSprintNames) {
      await logActivity(tx, {
        type: "TASK_SPRINT_REMOVED",
        taskId,
        actorId: session.user.id,
        metadata: { sprintName },
      });
    }
  });

  revalidatePath(`/projects/${task.projectId}/backlog`);
  revalidatePath(`/projects/${task.projectId}/sprints`);
  revalidatePath(`/projects/${task.projectId}/list`);
  revalidatePath(`/projects/${task.projectId}/board`);
}
