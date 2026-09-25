"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteSprint, canStartSprint, validateSprintDates } from "@/lib/sprint-logic";
import { canMoveTaskToSprint, getRemovableSprintIds } from "@/lib/backlog-logic";
import { logActivity, type PrismaTransactionClient } from "@/lib/activity-logger";
import { createNotifications } from "@/actions/notification";
import { buildSprintNotificationDeepLink, shouldDeliverWithPreferences } from "@/lib/notification-logic";
import type { Prisma, SprintStatus } from "@prisma/client";

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  return session.user.id;
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

async function requireSprintAccess(sprintId: string, userId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    throw new Error("Sprint bulunamadı.");
  }

  await requireMembership(sprint.projectId, userId);

  return sprint;
}

async function assertNoActiveSprint(projectId: string) {
  const activeSprint = await prisma.sprint.findFirst({
    where: { projectId, status: "ACTIVE" },
    select: { id: true },
  });

  const startCheck = canStartSprint(Boolean(activeSprint));
  if (!startCheck.allowed) {
    throw new Error(startCheck.reason);
  }
}

function getTaskSprintLinks(taskId: string) {
  return prisma.sprintTask.findMany({
    where: { taskId },
    select: { sprintId: true, sprint: { select: { status: true, name: true } } },
  });
}

// COMPLETED sprint geçmişi asla silinmez; yalnızca ACTIVE/DRAFT bağlantıları kaldırılabilir.
function pickRemovableLinks<T extends { sprintId: string; sprint: { status: SprintStatus } }>(
  links: T[],
  keepSprintId?: string,
): T[] {
  const removableSprintIds = new Set(getRemovableSprintIds(links));
  return links.filter(
    (link) => removableSprintIds.has(link.sprintId) && link.sprintId !== keepSprintId,
  );
}

async function unlinkTaskFromSprints(
  tx: PrismaTransactionClient,
  taskId: string,
  actorId: string,
  links: { sprintId: string; sprint: { name: string } }[],
) {
  if (links.length === 0) return;

  await tx.sprintTask.deleteMany({
    where: { taskId, sprintId: { in: links.map((link) => link.sprintId) } },
  });
  for (const link of links) {
    await logActivity(tx, {
      type: "TASK_SPRINT_REMOVED",
      taskId,
      actorId,
      metadata: { sprintName: link.sprint.name },
    });
  }
}

function revalidateSprintPlanningViews(projectId: string) {
  revalidatePath(`/projects/${projectId}/backlog`);
  revalidatePath(`/projects/${projectId}/sprints`);
  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/board`);
}

export type CreateSprintInput = {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: Date | null;
  endDate?: Date | null;
};

export async function createSprint(input: CreateSprintInput) {
  const userId = await requireUserId();

  await requireMembership(input.projectId, userId);

  if (!input.name.trim()) {
    throw new Error("Sprint adı zorunludur.");
  }

  const dateValidation = validateSprintDates(input.startDate, input.endDate);
  if (!dateValidation.valid) {
    throw new Error(dateValidation.error);
  }

  await assertNoActiveSprint(input.projectId);

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
  const userId = await requireUserId();

  const existingSprint = await requireSprintAccess(sprintId, userId);

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
  const userId = await requireUserId();

  const existingSprint = await requireSprintAccess(sprintId, userId);

  const deleteCheck = canDeleteSprint(existingSprint.status);
  if (!deleteCheck.allowed) {
    throw new Error(deleteCheck.reason);
  }

  await prisma.sprint.delete({ where: { id: sprintId } });

  revalidatePath(`/projects/${existingSprint.projectId}/sprints`);
}

export async function addTaskToSprint(sprintId: string, taskId: string) {
  const userId = await requireUserId();

  const sprint = await requireSprintAccess(sprintId, userId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  if (task.projectId !== sprint.projectId) {
    throw new Error("Görev bu projeye ait değil.");
  }

  const existingLink = await prisma.sprintTask.findUnique({
    where: { sprintId_taskId: { sprintId, taskId } },
    select: { sprintId: true },
  });

  if (!existingLink) {
    await prisma.$transaction(async (tx) => {
      await tx.sprintTask.create({ data: { sprintId, taskId } });
      await logActivity(tx, {
        type: "TASK_SPRINT_ADDED",
        taskId,
        actorId: userId,
        metadata: { sprintName: sprint.name },
      });
    });
  }

  revalidatePath(`/projects/${sprint.projectId}/sprints`);
}

export async function removeTaskFromSprint(sprintId: string, taskId: string) {
  const userId = await requireUserId();

  const sprint = await requireSprintAccess(sprintId, userId);

  await prisma.$transaction(async (tx) => {
    await tx.sprintTask.delete({
      where: { sprintId_taskId: { sprintId, taskId } },
    });
    await logActivity(tx, {
      type: "TASK_SPRINT_REMOVED",
      taskId,
      actorId: userId,
      metadata: { sprintName: sprint.name },
    });
  });

  revalidatePath(`/projects/${sprint.projectId}/sprints`);
}

export async function startSprint(sprintId: string) {
  const userId = await requireUserId();

  const sprint = await requireSprintAccess(sprintId, userId);

  await assertNoActiveSprint(sprint.projectId);

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
  const userId = await requireUserId();

  const sprint = await requireSprintAccess(sprintId, userId);

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
    select: { userId: true, user: { select: { notificationPreferences: true } } },
  });

  const notificationEntries: Prisma.NotificationCreateManyInput[] = members
    .filter((member) =>
      shouldDeliverWithPreferences({
        actorId: userId,
        recipientId: member.userId,
        type: "SPRINT_COMPLETED",
        preferences: member.user.notificationPreferences,
      }),
    )
    .map((member) => ({
      type: "SPRINT_COMPLETED",
      title: "Sprint tamamlandı",
      message: sprint.name,
      link: buildSprintNotificationDeepLink(sprint.projectId),
      actorId: userId,
      userId: member.userId,
    }));

  await createNotifications(notificationEntries);

  revalidatePath(`/projects/${sprint.projectId}/sprints`);

  return incompleteCount;
}

export async function moveTaskToSprint(taskId: string, targetSprintId: string) {
  const userId = await requireUserId();

  const targetSprint = await prisma.sprint.findUnique({
    where: { id: targetSprintId },
    select: { projectId: true, name: true, status: true },
  });

  const moveCheck = canMoveTaskToSprint(targetSprint);
  if (!moveCheck.allowed || !targetSprint) {
    throw new Error(moveCheck.reason ?? "Sprint bulunamadı.");
  }

  await requireMembership(targetSprint.projectId, userId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  if (task.projectId !== targetSprint.projectId) {
    throw new Error("Görev bu projeye ait değil.");
  }

  const existingLinks = await getTaskSprintLinks(taskId);

  const removableLinks = pickRemovableLinks(existingLinks, targetSprintId);
  const alreadyLinked = existingLinks.some((link) => link.sprintId === targetSprintId);

  if (removableLinks.length > 0 || !alreadyLinked) {
    await prisma.$transaction(async (tx) => {
      await unlinkTaskFromSprints(tx, taskId, userId, removableLinks);

      if (!alreadyLinked) {
        await tx.sprintTask.create({ data: { sprintId: targetSprintId, taskId } });
        await logActivity(tx, {
          type: "TASK_SPRINT_ADDED",
          taskId,
          actorId: userId,
          metadata: { sprintName: targetSprint.name },
        });
      }
    });
  }

  revalidateSprintPlanningViews(targetSprint.projectId);
}

export async function moveTaskToBacklog(taskId: string) {
  const userId = await requireUserId();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, userId);

  const removableLinks = pickRemovableLinks(await getTaskSprintLinks(taskId));
  if (removableLinks.length === 0) {
    return;
  }

  await prisma.$transaction((tx) => unlinkTaskFromSprints(tx, taskId, userId, removableLinks));

  revalidateSprintPlanningViews(task.projectId);
}
