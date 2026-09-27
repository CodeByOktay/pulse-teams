/**
 * Internal agent API — POST /api/internal/agent/standup-synthesize (Phase 6 Step 6.05).
 *
 * Called by Agent-005 (Async Daily Standup) in the `pulse-agent` container at the 11:30
 * (Europe/Istanbul) cut-off. Runs the session-independent `synthesizeStandup` for one project.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { synthesizeStandup } from "@/lib/standup-service";

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
    const result = await synthesizeStandup(projectId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Internal Agent API] standup-synthesize error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
