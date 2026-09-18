"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateStateName, validateHexColor, canDeleteState } from "@/lib/settings-logic";
import type { StateGroup } from "@prisma/client";

async function requireAdmin(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership || membership.role !== "ADMIN") {
    throw new Error("Bu işlem için proje yöneticisi olmalısınız.");
  }

  return membership;
}

export type CreateStateInput = {
  projectId: string;
  name: string;
  color: string;
  group: StateGroup;
};

export async function createState(input: CreateStateInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  await requireAdmin(input.projectId, session.user.id);

  const nameValidation = validateStateName(input.name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error);
  }

  if (!validateHexColor(input.color)) {
    throw new Error("Renk #RRGGBB formatında olmalıdır.");
  }

  const trimmedName = input.name.trim();

  const existing = await prisma.state.findUnique({
    where: { name_projectId: { name: trimmedName, projectId: input.projectId } },
  });

  if (existing) {
    throw new Error("Bu isimde bir durum zaten mevcut.");
  }

  const lastState = await prisma.state.findFirst({
    where: { projectId: input.projectId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  const state = await prisma.state.create({
    data: {
      name: trimmedName,
      color: input.color,
      group: input.group,
      projectId: input.projectId,
      sequence: lastState ? lastState.sequence + 1000 : 1000,
    },
  });

  revalidatePath(`/projects/${input.projectId}/settings`);
  revalidatePath(`/projects/${input.projectId}/board`);

  return state;
}

export type UpdateStateInput = Partial<{
  name: string;
  color: string;
  group: StateGroup;
}>;

export async function updateState(stateId: string, data: UpdateStateInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const existingState = await prisma.state.findUnique({ where: { id: stateId } });
  if (!existingState) {
    throw new Error("Durum bulunamadı.");
  }

  await requireAdmin(existingState.projectId, session.user.id);

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) {
    const nameValidation = validateStateName(data.name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const trimmedName = data.name.trim();

    if (trimmedName !== existingState.name) {
      const existing = await prisma.state.findUnique({
        where: { name_projectId: { name: trimmedName, projectId: existingState.projectId } },
      });
      if (existing) {
        throw new Error("Bu isimde bir durum zaten mevcut.");
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

  if (data.group !== undefined) {
    updateData.group = data.group;
  }

  const state = await prisma.state.update({
    where: { id: stateId },
    data: updateData,
  });

  revalidatePath(`/projects/${existingState.projectId}/settings`);
  revalidatePath(`/projects/${existingState.projectId}/board`);

  return state;
}

export async function deleteState(stateId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const existingState = await prisma.state.findUnique({ where: { id: stateId } });
  if (!existingState) {
    throw new Error("Durum bulunamadı.");
  }

  await requireAdmin(existingState.projectId, session.user.id);

  const [taskCount, totalStateCount] = await Promise.all([
    prisma.task.count({ where: { stateId } }),
    prisma.state.count({ where: { projectId: existingState.projectId } }),
  ]);

  const check = canDeleteState(taskCount, totalStateCount);
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  await prisma.state.delete({ where: { id: stateId } });

  revalidatePath(`/projects/${existingState.projectId}/settings`);
  revalidatePath(`/projects/${existingState.projectId}/board`);
}

export async function reorderStates(projectId: string, orderedStateIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  await requireAdmin(projectId, session.user.id);

  const states = await prisma.state.findMany({
    where: { projectId },
    select: { id: true },
  });

  const stateIdSet = new Set(states.map((s) => s.id));
  if (
    orderedStateIds.length !== states.length ||
    !orderedStateIds.every((id) => stateIdSet.has(id))
  ) {
    throw new Error("Geçersiz durum listesi.");
  }

  await prisma.$transaction(
    orderedStateIds.map((stateId, index) =>
      prisma.state.update({
        where: { id: stateId },
        data: { sequence: (index + 1) * 1000 },
      }),
    ),
  );

  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath(`/projects/${projectId}/board`);
}
