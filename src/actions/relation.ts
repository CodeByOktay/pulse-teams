"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, requireMembership } from "@/lib/authz";
import { logActivity } from "@/lib/activity-logger";
import { emitDomainEvent } from "@/lib/domain-events";
import { parseTaskIdentifier } from "@/lib/search-logic";
import {
  collectBlockEdges,
  formatTaskIdentifier,
  hasExistingRelation,
  isSelfRelation,
  requiresCycleCheck,
  wouldCreateBlockCycle,
  type RelatedTaskSummary,
} from "@/lib/relation-logic";
import type { Prisma, RelationType } from "@prisma/client";

function revalidateProjectViews(projectId: string) {
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/backlog`);
}

export async function addTaskRelation(
  sourceTaskId: string,
  targetTaskId: string,
  type: RelationType,
) {
  const userId = await requireUserId();

  if (isSelfRelation(sourceTaskId, targetTaskId)) {
    throw new Error("Bir görev kendisiyle ilişkilendirilemez.");
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: [sourceTaskId, targetTaskId] } },
    select: {
      id: true,
      projectId: true,
      sequenceId: true,
      project: { select: { identifier: true } },
    },
  });

  const sourceTask = tasks.find((task) => task.id === sourceTaskId);
  const targetTask = tasks.find((task) => task.id === targetTaskId);

  if (!sourceTask || !targetTask) {
    throw new Error("Görev bulunamadı.");
  }

  if (sourceTask.projectId !== targetTask.projectId) {
    throw new Error("Görevler aynı projede olmalıdır.");
  }

  // projectId istemciden değil, doğrulanmış görev kaydından alınır.
  const projectId = sourceTask.projectId;
  await requireMembership(projectId, userId);

  const projectRelations = await prisma.taskRelation.findMany({
    where: { sourceTask: { projectId } },
    select: { sourceTaskId: true, targetTaskId: true, type: true },
  });

  if (hasExistingRelation(projectRelations, sourceTaskId, targetTaskId)) {
    throw new Error("Bu iki görev arasında zaten bir ilişki var.");
  }

  if (
    requiresCycleCheck(type) &&
    wouldCreateBlockCycle(collectBlockEdges(projectRelations), sourceTaskId, targetTaskId)
  ) {
    throw new Error("Bu ilişki döngüsel bağımlılık oluşturur.");
  }

  const targetIdentifier = formatTaskIdentifier(
    targetTask.project.identifier,
    targetTask.sequenceId,
  );

  const relation = await prisma.$transaction(async (tx) => {
    const created = await tx.taskRelation.create({
      data: { sourceTaskId, targetTaskId, type },
    });

    await logActivity(tx, {
      type: "TASK_RELATION_ADDED",
      taskId: sourceTaskId,
      actorId: userId,
      metadata: { targetIdentifier, type },
    });

    if (type === "BLOCKS") {
      await emitDomainEvent(tx, "TASK_RELATION_CREATED", {
        projectId,
        sourceTaskId,
        targetTaskId,
        type,
      });
    }

    return created;
  });

  revalidateProjectViews(projectId);

  return relation;
}

export async function removeTaskRelation(relationId: string) {
  const userId = await requireUserId();

  const relation = await prisma.taskRelation.findUnique({
    where: { id: relationId },
    select: {
      sourceTaskId: true,
      type: true,
      sourceTask: { select: { projectId: true } },
      targetTask: {
        select: { sequenceId: true, project: { select: { identifier: true } } },
      },
    },
  });

  if (!relation) {
    throw new Error("İlişki bulunamadı.");
  }

  const projectId = relation.sourceTask.projectId;
  await requireMembership(projectId, userId);

  const targetIdentifier = formatTaskIdentifier(
    relation.targetTask.project.identifier,
    relation.targetTask.sequenceId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.taskRelation.delete({ where: { id: relationId } });

    await logActivity(tx, {
      type: "TASK_RELATION_REMOVED",
      taskId: relation.sourceTaskId,
      actorId: userId,
      metadata: { targetIdentifier, type: relation.type },
    });
  });

  revalidateProjectViews(projectId);
}

export async function searchTasksForRelation(
  projectId: string,
  currentTaskId: string,
  query: string,
): Promise<RelatedTaskSummary[]> {
  const userId = await requireUserId();

  const currentTask = await prisma.task.findUnique({
    where: { id: currentTaskId },
    select: { projectId: true },
  });

  if (!currentTask) {
    throw new Error("Görev bulunamadı.");
  }

  if (currentTask.projectId !== projectId) {
    throw new Error("Görev bu projeye ait değil.");
  }

  await requireMembership(currentTask.projectId, userId);

  const existingRelations = await prisma.taskRelation.findMany({
    where: { OR: [{ sourceTaskId: currentTaskId }, { targetTaskId: currentTaskId }] },
    select: { sourceTaskId: true, targetTaskId: true },
  });

  const excludeIds = [
    ...new Set([
      currentTaskId,
      ...existingRelations.flatMap((relation) => [relation.sourceTaskId, relation.targetTaskId]),
    ]),
  ];

  const normalized = query.trim();
  const where: Prisma.TaskWhereInput = {
    projectId: currentTask.projectId,
    id: { notIn: excludeIds },
  };

  if (normalized) {
    const identifierMatch = parseTaskIdentifier(normalized);
    const taskOr: Prisma.TaskWhereInput[] = [
      { title: { contains: normalized, mode: "insensitive" } },
    ];

    if (identifierMatch) {
      taskOr.push({
        project: { identifier: identifierMatch.projectIdentifier },
        sequenceId: identifierMatch.sequenceId,
      });
    }

    where.OR = taskOr;
  }

  const tasks = await prisma.task.findMany({
    where,
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      sequenceId: true,
      title: true,
      state: { select: { name: true, color: true } },
      project: { select: { identifier: true } },
    },
  });

  return tasks.map((task) => ({
    id: task.id,
    sequenceId: task.sequenceId,
    title: task.title,
    stateName: task.state.name,
    stateColor: task.state.color,
    projectIdentifier: task.project.identifier,
  }));
}
