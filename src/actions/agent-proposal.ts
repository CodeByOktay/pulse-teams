"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity, type PrismaTransactionClient } from "@/lib/activity-logger";
import { isCompletionTransition } from "@/lib/automation-logic";
import { triggerUnblockedDependencies } from "@/lib/dependency-automation";
import { isProposalStale } from "@/lib/ai-proposal-logic";
import { createProposalForResponse, loadTaskProposals } from "@/lib/ai/proposal-service";

const PROPOSAL_NOT_PENDING_MESSAGE = "Bu öneri artık geçerli değil.";
const STATE_NOT_IN_PROJECT_MESSAGE = "Seçilen durum bu projeye ait değil.";

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

function revalidateProjectViews(projectId: string) {
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/backlog`);
}

// Atomik PENDING -> APPROVED/REJECTED geçişi; eşzamanlı ikinci istek hata alır.
async function claimPendingProposal(
  tx: PrismaTransactionClient,
  proposalId: string,
  status: "APPROVED" | "REJECTED",
  reviewerId: string,
) {
  const claimed = await tx.agentProposal.updateMany({
    where: { id: proposalId, status: "PENDING" },
    data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
  });

  if (claimed.count === 0) {
    throw new Error(PROPOSAL_NOT_PENDING_MESSAGE);
  }
}

async function hasProposalGoneStale(
  proposal: { createdAt: Date },
  task: { id: string; stateId: string },
  targetStateId: string,
): Promise<boolean> {
  if (isProposalStale(task.stateId, targetStateId)) {
    return true;
  }

  const stateChangedSince = await prisma.activity.findFirst({
    where: {
      taskId: task.id,
      type: "TASK_STATE_CHANGED",
      createdAt: { gt: proposal.createdAt },
    },
    select: { id: true },
  });

  return stateChangedSince !== null;
}

export async function generateProposalForResponse(responseId: string) {
  const userId = await requireUserId();

  const response = await prisma.progressResponse.findUnique({
    where: { id: responseId },
    select: { request: { select: { projectId: true } } },
  });

  if (!response) {
    throw new Error("İlerleme yanıtı bulunamadı.");
  }

  const projectId = response.request.projectId;
  await requireMembership(projectId, userId);

  const proposal = await createProposalForResponse(responseId);
  if (!proposal) {
    throw new Error("Öneri oluşturulamadı.");
  }

  revalidateProjectViews(projectId);

  return proposal;
}

export async function approveProposal(proposalId: string, overrideStateId?: string) {
  const reviewerId = await requireUserId();

  const proposal = await prisma.agentProposal.findUnique({
    where: { id: proposalId },
    select: {
      status: true,
      suggestedStateId: true,
      suggestedGroup: true,
      summary: true,
      createdAt: true,
      task: {
        select: {
          id: true,
          title: true,
          projectId: true,
          stateId: true,
          state: { select: { name: true, group: true } },
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
    throw new Error(PROPOSAL_NOT_PENDING_MESSAGE);
  }

  let overrideState: { id: string; name: string; group: string } | null = null;
  if (overrideStateId !== undefined) {
    overrideState = await prisma.state.findFirst({
      where: { id: overrideStateId, projectId: task.projectId },
      select: { id: true, name: true, group: true },
    });
    if (!overrideState) {
      throw new Error(STATE_NOT_IN_PROJECT_MESSAGE);
    }
  }

  const target = overrideStateId ?? proposal.suggestedStateId;

  // Açık bir override varsa insanın seçimi kazanır; bayatlık kontrolü yalnızca override yokken yapılır.
  // Hedef durumu olmayan öneriler (ör. yalnızca engel bildirimi) durum değişikliği içermez, bayatlamaz.
  if (overrideStateId === undefined && target !== null) {
    if (await hasProposalGoneStale(proposal, task, target)) {
      await prisma.agentProposal.updateMany({
        where: { id: proposalId, status: "PENDING" },
        data: { status: "STALE" },
      });
      revalidateProjectViews(task.projectId);
      throw new Error("Görev durumu öneriden sonra değişti; öneri geçersiz sayıldı.");
    }
  }

  // Görev zaten hedef durumdaysa taşıma yoktur; override durumu yukarıda okundu, tekrar sorgulanmaz.
  const moveTargetId = target && target !== task.stateId ? target : null;
  const targetState =
    moveTargetId === null
      ? null
      : (overrideState ??
        (await prisma.state.findUnique({
          where: { id: moveTargetId },
          select: { id: true, name: true, group: true },
        })));
  if (moveTargetId !== null && !targetState) {
    throw new Error(STATE_NOT_IN_PROJECT_MESSAGE);
  }

  const completed =
    targetState !== null && isCompletionTransition(task.state.group, targetState.group);

  await prisma.$transaction(async (tx) => {
    await claimPendingProposal(tx, proposalId, "APPROVED", reviewerId);

    if (targetState) {
      const lastTask = await tx.task.findFirst({
        where: { stateId: targetState.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      await tx.task.update({
        where: { id: task.id },
        data: {
          stateId: targetState.id,
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

      if (completed) {
        await logActivity(tx, {
          type: "TASK_COMPLETED",
          taskId: task.id,
          actorId: reviewerId,
        });
      }
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
  });

  // Transaction sonrası otomasyon: hata yakalama fonksiyonun içinde, onay işlemini etkilemez.
  if (completed) {
    await triggerUnblockedDependencies(task.id, task.title, task.projectId, reviewerId);
  }

  revalidateProjectViews(task.projectId);

  return { moved: targetState !== null };
}

export async function rejectProposal(proposalId: string) {
  const reviewerId = await requireUserId();

  const proposal = await prisma.agentProposal.findUnique({
    where: { id: proposalId },
    select: { taskId: true, task: { select: { projectId: true } } },
  });

  if (!proposal) {
    throw new Error("Öneri bulunamadı.");
  }

  await requireMembership(proposal.task.projectId, reviewerId);

  await prisma.$transaction(async (tx) => {
    await claimPendingProposal(tx, proposalId, "REJECTED", reviewerId);

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
  const userId = await requireUserId();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });

  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, userId);

  return loadTaskProposals(taskId);
}
