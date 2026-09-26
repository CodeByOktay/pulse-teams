"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, requireMembership } from "@/lib/authz";
import { logActivity } from "@/lib/activity-logger";
import { validateLabelName, validateHexColor } from "@/lib/settings-logic";

export async function createLabel({
  projectId,
  name,
  color,
}: {
  projectId: string;
  name: string;
  color: string;
}) {
  const session = await requireSession();

  await requireMembership(projectId, session.user.id);

  const nameValidation = validateLabelName(name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error);
  }

  if (!validateHexColor(color)) {
    throw new Error("Renk #RRGGBB formatında olmalıdır.");
  }

  const trimmedName = name.trim();

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
  revalidatePath(`/projects/${projectId}/settings`);

  return label;
}

export async function updateLabel(
  labelId: string,
  data: Partial<{ name: string; color: string }>,
) {
  const session = await requireSession();

  const existingLabel = await prisma.label.findUnique({ where: { id: labelId } });
  if (!existingLabel) {
    throw new Error("Etiket bulunamadı.");
  }

  await requireMembership(existingLabel.projectId, session.user.id);

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) {
    const nameValidation = validateLabelName(data.name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const trimmedName = data.name.trim();

    if (trimmedName !== existingLabel.name) {
      const existing = await prisma.label.findUnique({
        where: { name_projectId: { name: trimmedName, projectId: existingLabel.projectId } },
      });
      if (existing) {
        throw new Error("Bu isimde bir etiket zaten var.");
      }
    }

    updateData.name = trimmedName;
  }

  if (data.color !== undefined) {
    if (!validateHexColor(data.color)) {
      throw new Error("Renk #RRGGBB formatında olmalıdır.");
    }
    updateData.color = data.color;
  }

  const label = await prisma.label.update({
    where: { id: labelId },
    data: updateData,
  });

  revalidatePath(`/projects/${existingLabel.projectId}/board`);
  revalidatePath(`/projects/${existingLabel.projectId}/settings`);

  return label;
}

export async function deleteLabel(labelId: string) {
  const session = await requireSession();

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) {
    throw new Error("Etiket bulunamadı.");
  }

  await requireMembership(label.projectId, session.user.id);

  await prisma.label.delete({ where: { id: labelId } });

  revalidatePath(`/projects/${label.projectId}/board`);
  revalidatePath(`/projects/${label.projectId}/settings`);
}

export async function addLabelToTask(taskId: string, labelId: string) {
  const session = await requireSession();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.taskLabel.create({ data: { taskId, labelId } });
      const label = await tx.label.findUnique({ where: { id: labelId } });
      await logActivity(tx, {
        type: "TASK_LABEL_ADDED",
        taskId,
        actorId: session.user.id,
        metadata: { labelName: label?.name ?? "Bilinmeyen etiket" },
      });
    });
  } catch {
    // already attached — no-op
  }

  revalidatePath(`/projects/${task.projectId}/board`);
}

export async function removeLabelFromTask(taskId: string, labelId: string) {
  const session = await requireSession();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } });
      const label = await tx.label.findUnique({ where: { id: labelId } });
      await logActivity(tx, {
        type: "TASK_LABEL_REMOVED",
        taskId,
        actorId: session.user.id,
        metadata: { labelName: label?.name ?? "Bilinmeyen etiket" },
      });
    });
  } catch {
    // not attached — no-op
  }

  revalidatePath(`/projects/${task.projectId}/board`);
}
