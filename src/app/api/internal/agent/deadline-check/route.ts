/**
 * Internal agent API — POST /api/internal/agent/deadline-check (Phase 6 Step 6.02).
 *
 * Called by Agent-001 (Deadline Tracker) in the `pulse-agent` container. Runs the
 * session-independent `dispatchDueDateReminders` for one project and returns its counts.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { dispatchDueDateReminders } from "@/lib/deadline-tracker-service";

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
    const result = await dispatchDueDateReminders(projectId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Internal Agent API] deadline-check error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
