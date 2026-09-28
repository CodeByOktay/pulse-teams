/**
 * LLM model smoke check — developer/ops tool (no DB access).
 *
 * Runs the five production LLM interpreters (progress, standup, weekly digest, workload,
 * sprint retro) once per model with realistic Turkish sample input and reports, per call:
 * HTTP status, latency, provider-reported token usage, and whether the interpreter fell back
 * to its deterministic heuristic (i.e. the LLM output was unusable).
 *
 * Usage:
 *   npm run llm:check                           # model from ai.config.json / AI_MODEL
 *   npm run llm:check -- gpt-oss-120b gemma-4-26b
 *
 * Each model is tested with a 60 s timeout so real latency is measured; calls slower than the
 * production timeout (AI_TIMEOUT_MS, default 8000 ms) are flagged because they would fall back.
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

import { loadLlmConfig } from "@/lib/ai/llm-config";
import { analyzeProgressText } from "@/lib/ai/interpreter";
import { analyzeStandupText } from "@/lib/ai/standup-interpreter";
import { analyzeWeeklyDigest } from "@/lib/ai/weekly-digest-interpreter";
import { analyzeWorkloadReassignment } from "@/lib/ai/workload-interpreter";
import { analyzeSprintRetro } from "@/lib/ai/sprint-retro-interpreter";

const PRODUCTION_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || loadLlmConfig()?.timeoutMs || 8000;

interface CallRecord {
  status: number | "network-error";
  ms: number;
  promptTokens: number;
  completionTokens: number;
}

let calls: CallRecord[] = [];
let warnings: string[] = [];

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const started = Date.now();
  try {
    const response = await originalFetch(input, init);
    const record: CallRecord = { status: response.status, ms: Date.now() - started, promptTokens: 0, completionTokens: 0 };
    try {
      const body = (await response.clone().json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
      record.promptTokens = body.usage?.prompt_tokens ?? 0;
      record.completionTokens = body.usage?.completion_tokens ?? 0;
    } catch {
      // non-JSON body
    }
    calls.push(record);
    return response;
  } catch (error) {
    calls.push({ status: "network-error", ms: Date.now() - started, promptTokens: 0, completionTokens: 0 });
    throw error;
  }
};
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
};

const FEATURES: { name: string; run: () => Promise<unknown>; excerpt: (result: unknown) => string }[] = [
  {
    name: "İlerleme yorumu (Agent-003)",
    run: () =>
      analyzeProgressText({
        content: "API entegrasyonunu bitirdim, testler de geçti. Sadece code review bekliyor, yarın merge ederim.",
        currentTaskTitle: "Ödeme servisi API entegrasyonu",
        currentStateName: "Devam Ediyor",
        currentStateGroup: "IN_PROGRESS",
        availableStates: [
          { id: "s1", name: "Yapılacak", group: "TODO" },
          { id: "s2", name: "Devam Ediyor", group: "IN_PROGRESS" },
          { id: "s3", name: "İncelemede", group: "IN_PROGRESS" },
          { id: "s4", name: "Tamamlandı", group: "DONE" },
        ],
      }),
    excerpt: (r) => JSON.stringify(r),
  },
  {
    name: "Standup özeti (Agent-005)",
    run: () =>
      analyzeStandupText({
        projectName: "Pulse Core",
        entries: [
          { userId: "u1", userName: "Zeynep Çelik", yesterday: "Kanban sürükle-bırak hatasını düzelttim.", today: "Bildirim servisine birim test yazacağım.", blockers: null },
          { userId: "u2", userName: "Can Arslan", yesterday: "Veritabanı migration'ını hazırladım.", today: "Staging ortamına deploy.", blockers: "Staging DB erişim yetkim yok, DevOps'tan bekliyorum." },
          { userId: "u3", userName: "Elif Aydın", yesterday: "Dashboard tasarımını tamamladım.", today: "Responsive düzen iyileştirmeleri.", blockers: null },
        ],
      }),
    excerpt: (r) => (r as { summary?: string }).summary ?? JSON.stringify(r),
  },
  {
    name: "Haftalık karne (Agent-006)",
    run: () =>
      analyzeWeeklyDigest({
        projectName: "Pulse Core",
        weekNumber: 39,
        healthStatus: "AT_RISK",
        metrics: {
          completedThisWeek: 7,
          inProgressCount: 9,
          overdueCount: 3,
          velocity: 6.5,
          sprintName: "Sprint 12",
          sprintEndDate: new Date("2026-10-02T17:00:00Z"),
          daysRemaining: 4,
        },
      }),
    excerpt: (r) => JSON.stringify(r),
  },
  {
    name: "İş yükü önerisi (Agent-007)",
    run: () =>
      analyzeWorkloadReassignment({
        pmName: "Ahmet Yılmaz",
        overloadedMemberName: "Can Arslan",
        overloadedActiveCount: 8,
        task: { title: "Bildirim servisinde kuyruk gecikmesini azalt", labels: ["backend", "performance"] },
        candidates: [
          { userId: "u4", userName: "Burak Şahin", recentLabels: ["backend", "database"] },
          { userId: "u5", userName: "Mert Aksoy", recentLabels: ["frontend", "ui"] },
        ],
      }),
    excerpt: (r) => JSON.stringify(r),
  },
  {
    name: "Retro taslağı (Agent-008)",
    run: () =>
      analyzeSprintRetro({
        sprintName: "Sprint 11",
        completedCount: 14,
        overdueCount: 3,
        scopeCreepInjectedCount: 4,
        blockerFindingsCount: 2,
        completedTaskTitles: ["Kanban sürükle-bırak", "Bildirim tercihleri", "Dashboard metrikleri"],
        overdueTaskTitles: ["Staging deploy otomasyonu"],
        scopeCreepTaskTitles: ["Acil güvenlik yaması", "Müşteri demo hazırlığı"],
        blockerTaskTitles: ["Staging DB erişimi"],
      }),
    excerpt: (r) => String(r),
  },
];

function short(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

async function checkModel(model: string): Promise<{ promptTokens: number; completionTokens: number }> {
  process.env.AI_MODEL = model;
  process.env.AI_TIMEOUT_MS = "60000";
  console.log(`\n=== ${model} ===`);
  const totals = { promptTokens: 0, completionTokens: 0 };

  for (const feature of FEATURES) {
    calls = [];
    warnings = [];
    const result = await feature.run();
    const call = calls[0];
    const usedLlm = warnings.length === 0 && call?.status === 200;
    const slow = call && call.ms > PRODUCTION_TIMEOUT_MS;
    totals.promptTokens += call?.promptTokens ?? 0;
    totals.completionTokens += call?.completionTokens ?? 0;

    const verdict = !call
      ? "NO CALL"
      : usedLlm
        ? slow
          ? `LLM OK but ${call.ms} ms > ${PRODUCTION_TIMEOUT_MS} ms (would fall back in prod)`
          : "LLM OK"
        : `FALLBACK (${warnings[0] ? short(warnings[0], 120) : `HTTP ${call.status}`})`;
    console.log(
      `- ${feature.name}: ${verdict} | HTTP ${call?.status ?? "-"} | ${call?.ms ?? 0} ms | tokens ${call?.promptTokens ?? 0} in / ${call?.completionTokens ?? 0} out`,
    );
    console.log(`    ↳ ${short(feature.excerpt(result))}`);
  }

  console.log(`  Total: ${totals.promptTokens} in + ${totals.completionTokens} out = ${totals.promptTokens + totals.completionTokens} tokens`);
  return totals;
}

async function main(): Promise<void> {
  const base = loadLlmConfig();
  if (!base) {
    console.error("LLM is not configured (endpoint/model missing).");
    process.exitCode = 1;
    return;
  }
  const models = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  console.log(`Endpoint: ${base.endpoint} | jsonMode: ${base.jsonMode} | production timeout: ${PRODUCTION_TIMEOUT_MS} ms`);

  let grand = 0;
  for (const model of models.length > 0 ? models : [base.model]) {
    const totals = await checkModel(model);
    grand += totals.promptTokens + totals.completionTokens;
  }
  console.log(`\nGrand total: ${grand} tokens`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
