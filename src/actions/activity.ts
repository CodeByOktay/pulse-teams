"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, requireMembership } from "@/lib/authz";

export async function getTaskActivities(taskId: string, take = 20, skip = 0) {
  const session = await requireSession();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  const activities = await prisma.activity.findMany({
    where: { taskId },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  return activities;
}
