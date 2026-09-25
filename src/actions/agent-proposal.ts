"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { isCompletionTransition } from "@/lib/automation-logic";
import { triggerUnblockedDependencies } from "@/lib/dependency-automation";
import { isProposalStale } from "@/lib/ai-proposal-logic";
import { createProposalForResponse, loadTaskProposals } from "@/lib/ai/proposal-service";

async function requireMembership(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership) {
    throw new Error("Bu proje üzerinde işlem yapma yetkiniz yok.");
  }

  return membership;
}

function revalidateProjectViews(projectId: string) {
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/backlog`);
}

export async function generateProposalForResponse(responseId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const response = await prisma.progressResponse.findUnique({
    where: { id: responseId },
    select: { request: { select: { projectId: true } } },
  });

  if (!response) {
    throw new Error("İlerleme yanıtı bulunamadı.");
  }

  const projectId = response.request.projectId;
  await requireMembership(projectId, session.user.id);

  const proposal = await createProposalForResponse(responseId);
  if (!proposal) {
    throw new Error("Öneri oluşturulamadı.");
  }

  revalidateProjectViews(projectId);

  return proposal;
}

export async function approveProposal(proposalId: string, overrideStateId?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const reviewerId = session.user.id;

  const proposal = await prisma.agentProposal.findUnique({
    where: { id: proposalId },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          projectId: true,
          stateId: true,
          state: { select: { id: true, name: true, group: true } },
        },
      },
    },
  });

  if (!proposal) {
    throw new Error("Öneri bulunamadı.");
  }

  const task = proposal.task;
  await requireMembership(task.projectId, reviewerId);

  if (proposal.status !== "PENDING") {
    throw new Error("Bu öneri artık geçerli değil.");
  }

  if (overrideStateId !== undefined) {
    const overrideState = await prisma.state.findFirst({
      where: { id: overrideStateId, projectId: task.projectId },
      select: { id: true },
    });
    if (!overrideState) {
      throw new Error("Seçilen durum bu projeye ait değil.");
    }
  }

  const target = overrideStateId ?? proposal.suggestedStateId;

  // Açık bir override varsa insanın seçimi kazanır; bayatlık kontrolü yalnızca override yokken yapılır.
  // Hedef durumu olmayan öneriler (ör. yalnızca engel bildirimi) durum değişikliği içermez, bayatlamaz.
  if (overrideStateId === undefined && target !== null) {
    const stateChangedSince = await prisma.activity.findFirst({
      where: {
        taskId: task.id,
        type: "TASK_STATE_CHANGED",
        createdAt: { gt: proposal.createdAt },
      },
      select: { id: true },
    });

    if (isProposalStale(task.stateId, target) || stateChangedSince !== null) {
      await prisma.agentProposal.updateMany({
        where: { id: proposalId, status: "PENDING" },
        data: { status: "STALE" },
      });
      revalidateProjectViews(task.projectId);
      throw new Error("Görev durumu öneriden sonra değişti; öneri geçersiz sayıldı.");
    }
  }

  const { moved, completed } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.agentProposal.updateMany({
      where: { id: proposalId, status: "PENDING" },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date() },
    });

    if (claimed.count === 0) {
      throw new Error("Bu öneri artık geçerli değil.");
    }

    let moved = false;
    let completed = false;

    if (target && target !== task.stateId) {
      const targetState = await tx.state.findUnique({
        where: { id: target },
        select: { id: true, name: true, group: true },
      });

      if (!targetState) {
        throw new Error("Seçilen durum bu projeye ait değil.");
      }

      const lastTask = await tx.task.findFirst({
        where: { stateId: target },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      await tx.task.update({
        where: { id: task.id },
        data: {
          stateId: target,
          sortOrder: lastTask ? lastTask.sortOrder + 10000 : 65535,
        },
      });

      await logActivity(tx, {
        type: "TASK_STATE_CHANGED",
        taskId: task.id,
        actorId: reviewerId,
        oldValue: task.state.name,
        newValue: targetState.name,
      });

      if (isCompletionTransition(task.state.group, targetState.group)) {
        await logActivity(tx, {
          type: "TASK_COMPLETED",
          taskId: task.id,
          actorId: reviewerId,
        });
        completed = true;
      }

      moved = true;
    }

    await logActivity(tx, {
      type: "AI_SUGGESTION_APPLIED",
      taskId: task.id,
      actorId: reviewerId,
      isAiGenerated: true,
      metadata: {
        proposalId,
        summary: proposal.summary,
        suggestedGroup: proposal.suggestedGroup,
        overridden: overrideStateId !== undefined && overrideStateId !== proposal.suggestedStateId,
      },
    });

    return { moved, completed };
  });

  // Transaction sonrası otomasyon: hata yakalama fonksiyonun içinde, onay işlemini etkilemez.
  if (completed) {
    await triggerUnblockedDependencies(task.id, task.title, task.projectId, reviewerId);
  }

  revalidateProjectViews(task.projectId);

  return { moved };
}

export async function rejectProposal(proposalId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const reviewerId = session.user.id;

  const proposal = await prisma.agentProposal.findUnique({
    where: { id: proposalId },
    select: { id: true, taskId: true, task: { select: { projectId: true } } },
  });

  if (!proposal) {
    throw new Error("Öneri bulunamadı.");
  }

  await requireMembership(proposal.task.projectId, reviewerId);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.agentProposal.updateMany({
      where: { id: proposalId, status: "PENDING" },
      data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt: new Date() },
    });

    if (claimed.count === 0) {
      throw new Error("Bu öneri artık geçerli değil.");
    }

    await logActivity(tx, {
      type: "AI_SUGGESTION_REJECTED",
      taskId: proposal.taskId,
      actorId: reviewerId,
      metadata: { proposalId },
    });
  });

  revalidateProjectViews(proposal.task.projectId);
}

export async function getTaskProposals(taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, stateId: true },
  });

  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  return loadTaskProposals(taskId);
}
