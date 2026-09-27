/**
 * Internal agent API — GET /api/internal/agent/settings?projectId=... (Phase 6 — ADR-034).
 *
 * Returns a project's `AgentSettings` rows plus the resolved PM user (the
 * first non-null `pmUser` across the settings rows, falling back to the
 * project owner). Used by the Python container to decide which agents are
 * enabled and whom to address notifications/requests to.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { syncClockFromDb } from "@/lib/clock";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // GET requests carry no body; the signature is computed over the empty string.
  if (!verifyInternalSignature(request.headers, "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId zorunludur." }, { status: 400 });
  }

  try {
    await syncClockFromDb();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
    }

    const settings = await prisma.agentSettings.findMany({
      where: { projectId },
      include: { pmUser: { select: { id: true, name: true, email: true } } },
    });

    const pmUser = settings.find((setting) => setting.pmUser)?.pmUser ?? project.owner;

    return NextResponse.json({ projectId, settings, pmUser });
  } catch (error) {
    console.error("[Internal Agent API] settings error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
