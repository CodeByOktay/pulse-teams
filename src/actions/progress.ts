"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, requireMembership } from "@/lib/authz";
import { logActivity } from "@/lib/activity-logger";
import { createNotification } from "@/actions/notification";
import { createProposalForResponse, loadTaskProposals } from "@/lib/ai/proposal-service";
import { buildNotificationDeepLink, shouldDeliverWithPreferences } from "@/lib/notification-logic";
import {
  canRequestProgress,
  formatProgressRequestNotification,
  validateProgressResponseContent,
} from "@/lib/progress-logic";

function revalidateProjectViews(projectId: string) {
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/backlog`);
}

export async function createProgressRequest(
  taskId: string,
  recipientId: string,
  reason: string = "manual",
) {
  const session = await requireSession();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      projectId: true,
      state: { select: { group: true } },
      assignees: { select: { userId: true } },
    },
  });

  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, session.user.id);

  if (!task.assignees.some((assignee) => assignee.userId === recipientId)) {
    throw new Error("Talep yalnızca göreve atanmış bir üyeye gönderilebilir.");
  }

  const pending = await prisma.progressRequest.findFirst({
    where: { taskId, status: "PENDING" },
    select: { id: true },
  });

  const check = canRequestProgress(task.state.group, task.assignees.length, pending !== null);
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.progressRequest.create({
      data: {
        projectId: task.projectId,
        taskId,
        recipientId,
        requestedById: session.user.id,
        reason,
      },
    });

    await logActivity(tx, {
      type: "PROGRESS_REQUESTED",
      taskId,
      actorId: session.user.id,
      metadata: { recipientId, reason },
    });

    return created;
  });

  if (
    shouldDeliverWithPreferences({
      actorId: session.user.id,
      recipientId,
      type: "PROGRESS_REQUESTED",
    })
  ) {
    const { title, message } = formatProgressRequestNotification(
      task.title,
      session.user.name ?? undefined,
    );

    await createNotification({
      type: "PROGRESS_REQUESTED",
      title,
      message,
      link: buildNotificationDeepLink(task.projectId, taskId),
      actorId: session.user.id,
      userId: recipientId,
    });
  }

  revalidateProjectViews(task.projectId);

  return request;
}

export async function submitProgressResponse(requestId: string, content: string) {
  const session = await requireSession();

  const progressRequest = await prisma.progressRequest.findUnique({
    where: { id: requestId },
    select: { id: true, taskId: true, projectId: true, recipientId: true, status: true },
  });

  if (!progressRequest) {
    throw new Error("İlerleme talebi bulunamadı.");
  }

  const membership = await requireMembership(progressRequest.projectId, session.user.id);

  if (session.user.id !== progressRequest.recipientId && membership.role !== "ADMIN") {
    throw new Error("Bu talebi yanıtlama yetkiniz yok.");
  }

  if (progressRequest.status !== "PENDING") {
    throw new Error("Bu ilerleme talebi artık yanıt beklemiyor.");
  }

  const validation = validateProgressResponseContent(content);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const trimmed = content.trim();

  const responseId = await prisma.$transaction(async (tx) => {
    // Eşzamanlı yanıtlara karşı: yalnızca hâlâ PENDING ise güncellenir.
    const updated = await tx.progressRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "RESPONDED" },
    });

    if (updated.count === 0) {
      throw new Error("Bu ilerleme talebi artık yanıt beklemiyor.");
    }

    const created = await tx.progressResponse.create({
      data: {
        progressRequestId: requestId,
        responderId: session.user.id,
        content: trimmed,
      },
    });

    await logActivity(tx, {
      type: "PROGRESS_RESPONDED",
      taskId: progressRequest.taskId,
      actorId: session.user.id,
      metadata: { snippet: trimmed.slice(0, 120) },
    });

    return created.id;
  });

  // Transaction dışında: en fazla ~8sn süren LLM çağrısı DB transaction'ını açık tutmaz.
  // createProposalForResponse asla hata fırlatmaz; başarısızlık yanıt gönderimini etkilemez.
  await createProposalForResponse(responseId);

  revalidateProjectViews(progressRequest.projectId);
}

export async function getTaskProgressData(taskId: string) {
  const session = await requireSession();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      state: { select: { group: true } },
      assignees: { select: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  const membership = await requireMembership(task.projectId, session.user.id);

  const [pending, history, proposals] = await Promise.all([
    prisma.progressRequest.findFirst({
      where: { taskId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: { select: { id: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
    }),
    prisma.progressRequest.findMany({
      where: { taskId, status: "RESPONDED" },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        requestedBy: { select: { id: true, name: true } },
        recipient: { select: { id: true, name: true } },
        responses: {
          orderBy: { createdAt: "desc" },
          include: { responder: { select: { id: true, name: true } } },
        },
      },
    }),
    loadTaskProposals(taskId),
  ]);

  return {
    taskStateGroup: task.state.group,
    assignees: task.assignees.map((assignee) => assignee.user),
    viewerIsAdmin: membership.role === "ADMIN",
    pending,
    history,
    proposals,
  };
}
