/**
 * Project Memory embedding backfill (Step 6.07 / ADR-035) — developer/ops tool.
 *
 * Tasks only get an embedding when they are created or their title/description changes
 * (`upsertTaskEmbedding` in src/actions/task.ts). Seeded or pre-existing tasks therefore have
 * none, and "Similar Tasks" / semantic Cmd+K search stay empty for them.
 *
 * Usage:
 *   npm run embeddings:backfill            # dry run: counts + token estimate, no API calls
 *   npm run embeddings:backfill -- --apply # generate missing/stale embeddings
 *   npm run embeddings:backfill -- --apply --force # re-embed every task with the configured model
 *
 * Reuses the production `upsertTaskEmbedding` (SHA-256 content hash => unchanged tasks are
 * skipped, so re-running is free). In --apply mode the provider's `usage.total_tokens` is
 * summed from the embedding responses to report the real token spend.
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

import { prisma } from "@/lib/prisma";
import { loadEmbeddingConfig } from "@/lib/ai/embeddings";
import { upsertTaskEmbedding } from "@/lib/embedding-service";
import { buildTaskEmbeddingText, shouldRegenerateEmbedding } from "@/lib/semantic-search";

const apply = process.argv.includes("--apply");
// Re-embed every task even if its content hash matches (e.g. replacing vectors that were not
// produced by the configured model — they share the hash but not the vector space).
const force = process.argv.includes("--force");

let providerTokens = 0;
let providerCalls = 0;

function trackEmbeddingUsage(endpoint: string): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === endpoint) {
      providerCalls += 1;
      try {
        const body = (await response.clone().json()) as { usage?: { total_tokens?: number } };
        providerTokens += body.usage?.total_tokens ?? 0;
      } catch {
        // usage is informational only
      }
    }
    return response;
  };
}

async function main(): Promise<void> {
  const config = loadEmbeddingConfig();
  if (!config) {
    console.error("Embedding is not configured (AI_EMBEDDING_ENDPOINT / AI_EMBEDDING_MODEL). Nothing to do.");
    process.exitCode = 1;
    return;
  }

  const tasks = await prisma.task.findMany({
    select: { id: true, title: true, description: true, sequenceId: true, project: { select: { identifier: true } } },
    orderBy: { createdAt: "asc" },
  });
  const hashes = await prisma.$queryRaw<{ taskId: string; contentHash: string }[]>`
    SELECT "taskId", "contentHash" FROM "TaskEmbedding"
  `;
  const hashByTask = new Map(hashes.map((row) => [row.taskId, row.contentHash]));

  const pending = tasks
    .map((task) => ({
      id: task.id,
      text: buildTaskEmbeddingText({
        title: task.title,
        description: task.description,
        sequenceId: task.sequenceId,
        projectIdentifier: task.project.identifier,
      }),
    }))
    .filter((task) => force || shouldRegenerateEmbedding(hashByTask.get(task.id), task.text));

  const chars = pending.reduce((sum, task) => sum + task.text.length, 0);
  console.log(`Model: ${config.model}${config.dimensions ? ` (dimensions=${config.dimensions})` : ""}`);
  console.log(`Tasks: ${tasks.length} total, ${tasks.length - pending.length} up to date, ${pending.length} to embed`);
  console.log(`Text: ${chars} characters -> estimated ${Math.round(chars / 4)}-${Math.round(chars / 3)} tokens`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to call the embedding API.");
    return;
  }

  trackEmbeddingUsage(config.endpoint);
  const started = Date.now();
  for (const [index, task] of pending.entries()) {
    if (force) {
      await prisma.$executeRaw`DELETE FROM "TaskEmbedding" WHERE "taskId" = ${task.id}`;
    }
    await upsertTaskEmbedding(task.id);
    if ((index + 1) % 10 === 0 || index + 1 === pending.length) {
      console.log(`  ${index + 1}/${pending.length}`);
    }
  }

  const embedded = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count FROM "TaskEmbedding" WHERE "taskId" = ANY(${pending.map((task) => task.id)})
  `;
  const succeeded = Number(embedded[0]?.count ?? 0);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`Embedded: ${succeeded}/${pending.length} (failed: ${pending.length - succeeded})`);
  console.log(`Provider usage: ${providerCalls} calls, ${providerTokens} tokens`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
