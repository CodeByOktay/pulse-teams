/**
 * Internal agent API — POST /api/internal/agent/progress-requests (Phase 6 — ADR-034).
 *
 * Creates a `ProgressRequest` on behalf of an AI agent. The "requester" is the
 * project's designated PM (`AgentSettings.pmUser`) when configured, falling
 * back to the project owner. Reuses `createProgressRequestForUser` so the
 * same business rules (`canRequestProgress`) apply as the session-based
 * `createProgressRequest` server action.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { createProgressRequestForUser } from "@/actions/progress";

export const dynamic = "force-dynamic";

type ProgressRequestBody = {
  projectId?: string;
  taskId?: string;
  recipientId?: string;
  customMessage?: string;
};

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ProgressRequestBody;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const { projectId, taskId, recipientId, customMessage } = body;
  if (!projectId || !taskId || !recipientId) {
    return NextResponse.json(
      { error: "projectId, taskId ve recipientId zorunludur." },
      { status: 400 },
    );
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task || task.projectId !== projectId) {
      return NextResponse.json({ error: "Görev bu projeye ait değil." }, { status: 400 });
    }

    const recipientMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: recipientId } },
    });
    if (!recipientMembership) {
      return NextResponse.json({ error: "Alıcı bu projenin üyesi değil." }, { status: 400 });
    }

    // PM temsilcisi: herhangi bir AgentSettings satırında atanmış pmUserId,
    // yoksa proje sahibi (ownerId) devreye girer.
    const pmSetting = await prisma.agentSettings.findFirst({
      where: { projectId, pmUserId: { not: null } },
      select: { pmUserId: true },
    });
    const requesterId = pmSetting?.pmUserId ?? project.ownerId;

    const created = await createProgressRequestForUser({
      requesterId,
      taskId,
      recipientId,
      reason: "scheduled",
      customMessage,
    });

    return NextResponse.json({ ok: true, request: created });
  } catch (error) {
    // İş kuralı ihlalleri (ör. bekleyen talep var, atanmamış alıcı) açıklayıcı
    // Error mesajlarıyla fırlatılır; bunları 400 olarak yansıtıyoruz.
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Internal Agent API] progress-requests error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
