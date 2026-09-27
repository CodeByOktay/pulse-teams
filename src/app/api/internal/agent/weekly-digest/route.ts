/**
 * Internal agent API — POST /api/internal/agent/weekly-digest (Phase 6 Step 6.05).
 *
 * Called by Agent-006 (Weekly Sprint Digest) in the `pulse-agent` container every Friday
 * 17:00 (Europe/Istanbul). Runs the session-independent `dispatchWeeklyDigest` for one project.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { resolveAgentNow } from "@/lib/internal-agent-request";
import { dispatchWeeklyDigest } from "@/lib/weekly-digest-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown; asOf?: unknown };
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const { projectId } = body;
  if (typeof projectId !== "string" || projectId.length === 0) {
    return NextResponse.json({ error: "projectId zorunludur." }, { status: 400 });
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
    const result = await dispatchWeeklyDigest(projectId, now);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Internal Agent API] weekly-digest error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
