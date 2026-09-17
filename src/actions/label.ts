"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
}

export async function createLabel({
  projectId,
  name,
  color,
}: {
  projectId: string;
  name: string;
  color: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  await requireMembership(projectId, session.user.id);

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Etiket adı zorunludur.");
  }

  if (!HEX_COLOR_REGEX.test(color)) {
    throw new Error("Renk #RRGGBB formatında olmalıdır.");
  }

  const existing = await prisma.label.findUnique({
    where: { name_projectId: { name: trimmedName, projectId } },
  });

  if (existing) {
    throw new Error("Bu isimde bir etiket zaten var.");
  }

  const label = await prisma.label.create({
    data: { name: trimmedName, color, projectId },
  });

  revalidatePath(`/projects/${projectId}/board`);

  return label;
}

export async function deleteLabel(labelId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) {
    throw new Error("Etiket bulunamadı.");
  }

  await requireMembership(label.projectId, session.user.id);

  await prisma.label.delete({ where: { id: labelId } });

  revalidatePath(`/projects/${label.projectId}/board`);
}

export async function addLabelToTask(taskId: string, labelId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  try {
    await prisma.taskLabel.create({ data: { taskId, labelId } });
  } catch {
    // already attached — no-op
  }

  revalidatePath(`/projects/${task.projectId}/board`);
}

export async function removeLabelFromTask(taskId: string, labelId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  try {
    await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } });
  } catch {
    // not attached — no-op
  }

  revalidatePath(`/projects/${task.projectId}/board`);
}
