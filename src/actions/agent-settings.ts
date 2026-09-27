"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, requireMembership, requireSession } from "@/lib/authz";

/** Agent keys that can be configured per project from the settings UI. */
const CONFIGURABLE_AGENT_KEYS = ["agent-001", "agent-002", "agent-003"] as const;

function assertConfigurableAgentKey(agentKey: string) {
  if (!(CONFIGURABLE_AGENT_KEYS as readonly string[]).includes(agentKey)) {
    throw new Error("Geçersiz ajan anahtarı.");
  }
}

/**
 * The PM representative must be an ADMIN member of the same project.
 */
async function assertValidPmUser(projectId: string, pmUserId: string | null | undefined) {
  if (!pmUserId) return;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: pmUserId } },
    select: { role: true },
  });
  if (!member || member.role !== "ADMIN") {
    throw new Error("Proje temsilcisi projenin yönetici üyelerinden biri olmalıdır.");
  }
}

export async function getProjectAgentSettings(projectId: string) {
  const session = await requireSession();
  await requireMembership(projectId, session.user.id);
  return prisma.agentSettings.findMany({
    where: { projectId },
    include: { pmUser: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateProjectAgentSetting(
  projectId: string,
  agentKey: string,
  data: {
    enabled?: boolean;
    config?: Record<string, unknown>;
    pmUserId?: string | null;
  },
) {
  await requireAdminSession(projectId);
  assertConfigurableAgentKey(agentKey);
  await assertValidPmUser(projectId, data.pmUserId);

  const config = data.config as Prisma.InputJsonValue | undefined;

  const updated = await prisma.agentSettings.upsert({
    where: { projectId_agentKey: { projectId, agentKey } },
    update: {
      enabled: data.enabled,
      config,
      pmUserId: data.pmUserId,
    },
    create: {
      projectId,
      agentKey,
      enabled: data.enabled ?? true,
      config: config ?? {},
      pmUserId: data.pmUserId ?? null,
    },
  });

  revalidatePath(`/projects/${projectId}/settings`);
  return updated;
}

/**
 * Sets the PM representative for every configurable agent of the project in
 * one transaction (the PM is a project-wide choice in the UI).
 */
export async function updateProjectPmUser(projectId: string, pmUserId: string | null) {
  await requireAdminSession(projectId);
  await assertValidPmUser(projectId, pmUserId);

  await prisma.$transaction(
    CONFIGURABLE_AGENT_KEYS.map((agentKey) =>
      prisma.agentSettings.upsert({
        where: { projectId_agentKey: { projectId, agentKey } },
        update: { pmUserId },
        create: { projectId, agentKey, pmUserId },
      }),
    ),
  );

  revalidatePath(`/projects/${projectId}/settings`);
}

export async function getProjectPmCandidates(projectId: string) {
  await requireAdminSession(projectId);
  const admins = await prisma.projectMember.findMany({
    where: { projectId, role: "ADMIN" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return admins.map((a) => a.user);
}
