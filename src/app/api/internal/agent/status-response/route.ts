/**
 * Internal agent API — POST /api/internal/agent/status-response (Phase 6 Step 6.03).
 *
 * Called by the `pulse-agent` container AFTER it resumes the Agent-003 LangGraph
 * `interrupt()` thread for a `ProgressRequest` (the row is already `RESPONDED`,
 * set earlier by `respondToProgressRequestQuick`). This route only performs the
 * deterministic Tier B/C side effects (AgentProposal creation, ADMIN escalation)
 * — it never mutates the task's state directly (Tier C: human-approved only).
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { syncClockFromDb } from "@/lib/clock";
import { formatTaskIdentifier } from "@/lib/relation-logic";
import { buildNotificationDeepLink } from "@/lib/notification-logic";
import { createNotifications } from "@/actions/notification";
import {
  buildBlockedEscalationNotice,
  buildBlockerProposalDetails,
  buildCompletionProposalSummary,
  COMPLETION_PROPOSAL_CONFIDENCE,
  isValidQuickAction,
} from "@/lib/status-requester-logic";

export const dynamic = "force-dynamic";

function revalidateProjectViews(projectId: string) {
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/list`);
  revalidatePath(`/projects/${projectId}/backlog`);
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { requestId?: unknown; action?: unknown };
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const { requestId, action } = body;
  if (typeof requestId !== "string" || requestId.length === 0) {
    return NextResponse.json({ error: "requestId zorunludur." }, { status: 400 });
  }
  if (typeof action !== "string" || !isValidQuickAction(action)) {
    return NextResponse.json({ error: "Geçersiz aksiyon türü." }, { status: 400 });
  }

  try {
    await syncClockFromDb();

    const progressRequest = await prisma.progressRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        task: {
          select: {
            title: true,
            sequenceId: true,
            projectId: true,
            project: { select: { identifier: true } },
            assignees: { include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    if (!progressRequest) {
      return NextResponse.json({ error: "İlerleme talebi bulunamadı." }, { status: 404 });
    }

    const latestResponse = await prisma.progressResponse.findFirst({
      where: { progressRequestId: requestId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const taskIdentifier = formatTaskIdentifier(
      progressRequest.task.project.identifier,
      progressRequest.task.sequenceId,
    );

    const { taskId, projectId } = progressRequest;

    if (action === "COMPLETED") {
      await prisma.$transaction(async (tx) => {
        await tx.agentProposal.updateMany({
          where: { taskId, status: "PENDING" },
          data: { status: "STALE" },
        });

        await tx.agentProposal.create({
          data: {
            projectId,
            taskId,
            progressResponseId: latestResponse?.id ?? null,
            summary: buildCompletionProposalSummary(taskIdentifier),
            suggestedGroup: "DONE",
            confidence: COMPLETION_PROPOSAL_CONFIDENCE,
          },
        });
      });

      revalidateProjectViews(projectId);
      return NextResponse.json({ ok: true, action, proposalCreated: true });
    }

    if (action === "BLOCKED") {
      const blockerDetails = buildBlockerProposalDetails(taskIdentifier);

      await prisma.agentProposal.create({
        data: {
          projectId,
          taskId,
          progressResponseId: latestResponse?.id ?? null,
          summary: blockerDetails,
          blockerDetected: true,
          blockerDetails,
        },
      });

      const assigneeName = progressRequest.task.assignees[0]?.user.name ?? "Atanmamış";
      const notice = buildBlockedEscalationNotice({ assigneeName, taskIdentifier });

      const admins = await prisma.projectMember.findMany({
        where: { projectId, role: "ADMIN" },
        select: { userId: true },
      });

      const entries: Prisma.NotificationCreateManyInput[] = admins.map((admin) => ({
        type: "PROGRESS_REQUESTED",
        title: notice.title,
        message: notice.message,
        link: buildNotificationDeepLink(projectId, taskId),
        userId: admin.userId,
        actorId: null,
      }));

      await createNotifications(entries);

      revalidateProjectViews(projectId);
      return NextResponse.json({ ok: true, action, proposalCreated: true });
    }

    // PROGRESSING — no proposal, no notification.
    revalidateProjectViews(projectId);
    return NextResponse.json({ ok: true, action, proposalCreated: false });
  } catch (err) {
    console.error("[Internal Agent API] status-response error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
