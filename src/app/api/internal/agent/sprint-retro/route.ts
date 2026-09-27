/**
 * Internal agent API — POST /api/internal/agent/sprint-retro (Phase 6 Step 6.06).
 *
 * Called by Agent-008 (Sprint Assistant) in the `pulse-agent` container when it
 * receives a `SPRINT_COMPLETED` DomainEvent. Runs the session-independent
 * `dispatchSprintRetro` for one completed sprint.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { resolveAgentNow } from "@/lib/internal-agent-request";
import { dispatchSprintRetro } from "@/lib/sprint-assistant-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown; sprintId?: unknown; asOf?: unknown };
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const { projectId, sprintId } = body;
  if (typeof projectId !== "string" || projectId.length === 0) {
    return NextResponse.json({ error: "projectId zorunludur." }, { status: 400 });
  }
  if (typeof sprintId !== "string" || sprintId.length === 0) {
    return NextResponse.json({ error: "sprintId zorunludur." }, { status: 400 });
  }

  const now = await resolveAgentNow(body);
  if (now === null) {
    return NextResponse.json({ error: "Geçersiz asOf tarihi." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
  }

  try {
    const result = await dispatchSprintRetro(projectId, sprintId, now);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Internal Agent API] sprint-retro error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
