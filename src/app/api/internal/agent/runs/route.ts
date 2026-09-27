/**
 * Internal agent API — POST /api/internal/agent/runs (Phase 6 — ADR-034).
 *
 * Upserts an `AgentRun` record keyed by the compound unique constraint
 * `(agentKey, projectId, scheduledFor)` so the Python scheduler can safely
 * retry/re-report a run (e.g. RUNNING -> SUCCESS) without creating duplicates.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { getNow } from "@/lib/clock";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["RUNNING", "SUCCESS", "FAILED", "SKIPPED"]);
const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "SKIPPED"]);

type RunBody = {
  agentKey?: string;
  projectId?: string;
  scheduledFor?: string;
  status?: string;
  result?: unknown;
  error?: string;
  tokenCount?: number;
};

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifyInternalSignature(request.headers, bodyText)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RunBody;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const { agentKey, projectId, scheduledFor, status, result, error, tokenCount } = body;

  if (!agentKey || !projectId || !scheduledFor || !status) {
    return NextResponse.json(
      { error: "agentKey, projectId, scheduledFor ve status zorunludur." },
      { status: 400 },
    );
  }

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "status RUNNING, SUCCESS, FAILED veya SKIPPED olmalıdır." },
      { status: 400 },
    );
  }

  const scheduledForDate = new Date(scheduledFor);
  if (Number.isNaN(scheduledForDate.getTime())) {
    return NextResponse.json({ error: "Geçersiz scheduledFor tarihi." }, { status: 400 });
  }

  if (tokenCount !== undefined && (typeof tokenCount !== "number" || tokenCount < 0)) {
    return NextResponse.json({ error: "tokenCount negatif olmayan bir sayı olmalıdır." }, { status: 400 });
  }

  try {
    const completedAt = TERMINAL_STATUSES.has(status) ? getNow() : undefined;
    const resultJson = result as Prisma.InputJsonValue | undefined;

    const run = await prisma.agentRun.upsert({
      where: {
        agentKey_projectId_scheduledFor: {
          agentKey,
          projectId,
          scheduledFor: scheduledForDate,
        },
      },
      update: {
        status,
        result: resultJson,
        error: error ?? undefined,
        tokenCount,
        completedAt,
      },
      create: {
        agentKey,
        projectId,
        scheduledFor: scheduledForDate,
        status,
        result: resultJson,
        error: error ?? undefined,
        tokenCount: tokenCount ?? 0,
        completedAt,
      },
    });

    return NextResponse.json({ ok: true, run });
  } catch (err) {
    console.error("[Internal Agent API] runs error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
