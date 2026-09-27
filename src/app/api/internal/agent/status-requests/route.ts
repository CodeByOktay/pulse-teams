/**
 * Internal agent API — POST /api/internal/agent/status-requests (Phase 6 Step 6.03).
 *
 * Called by Agent-003 (Status Requester) in the `pulse-agent` container. Runs the
 * session-independent `dispatchStatusRequests` for one project: expires stale
 * PENDING ProgressRequests (2-day timeout) and opens new ones for stale
 * IN_PROGRESS tasks. `openedRequests` lets Python start one LangGraph
 * `interrupt()` thread per newly opened request.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { dispatchStatusRequests } from "@/lib/status-requester-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown };
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const { projectId } = body;
  if (typeof projectId !== "string" || projectId.length === 0) {
    return NextResponse.json({ error: "projectId zorunludur." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
  }

  try {
    const result = await dispatchStatusRequests(projectId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Internal Agent API] status-requests error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
