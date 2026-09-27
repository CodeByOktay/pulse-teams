import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const AGENT_KEYS = [
  "agent-001",
  "agent-002",
  "agent-003",
  "agent-004",
  "agent-005",
  "agent-006",
  "agent-007",
  "agent-008",
  "agent-009",
];

const DIMENSIONS = 1536;

/**
 * Deterministic pseudo-semantic embedding generator for offline/demo use.
 * Maps word tokens and topic clusters into 1536 dimensions and normalizes to unit length.
 */
function generateDeterministicEmbedding(text) {
  const vec = new Float64Array(DIMENSIONS);
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) {
    vec[0] = 1.0;
    return Array.from(vec);
  }

  // Topic cluster dimensions
  const CLUSTERS = {
    auth: [10, 11, 12, 13, 14],
    login: [10, 11, 12, 13, 14],
    security: [10, 15, 16],
    db: [30, 31, 32, 33, 34],
    database: [30, 31, 32, 33, 34],
    prisma: [30, 31, 35, 36],
    postgres: [30, 31, 37, 38],
    ui: [50, 51, 52, 53, 54],
    kanban: [50, 55, 56, 57],
    drag: [50, 58, 59],
    sprint: [70, 71, 72, 73, 74],
    cycle: [70, 71, 75, 76],
    api: [90, 91, 92, 93],
    backend: [90, 94, 95],
    frontend: [50, 96, 97],
  };

  for (const word of words) {
    // Hash token to 3 deterministic bucket positions
    const h1 = parseInt(createHash("md5").update(word).digest("hex").slice(0, 8), 16) % DIMENSIONS;
    const h2 = parseInt(createHash("sha1").update(word).digest("hex").slice(0, 8), 16) % DIMENSIONS;
    const h3 = (h1 + h2 * 31) % DIMENSIONS;

    vec[h1] += 1.0;
    vec[h2] += 0.7;
    vec[h3] += 0.5;

    // Check cluster
    for (const [clusterWord, indices] of Object.entries(CLUSTERS)) {
      if (word.includes(clusterWord)) {
        for (const idx of indices) {
          vec[idx] += 2.0;
        }
      }
    }
  }

  // Normalize vector to unit length (L2 norm = 1.0)
  let norm = 0;
  for (let i = 0; i < DIMENSIONS; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < DIMENSIONS; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

function computeContentHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function main() {
  console.log("=== Pulse: Seeding AgentSettings and Deterministic TaskEmbeddings ===");

  // 1. Populate AgentSettings for all projects
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, identifier: true, ownerId: true },
  });

  console.log(`Found ${projects.length} project(s).`);

  let settingsCreated = 0;
  for (const project of projects) {
    for (const agentKey of AGENT_KEYS) {
      await prisma.agentSettings.upsert({
        where: {
          projectId_agentKey: {
            projectId: project.id,
            agentKey,
          },
        },
        create: {
          projectId: project.id,
          agentKey,
          enabled: true,
          pmUserId: project.ownerId,
        },
        update: {
          enabled: true,
          pmUserId: project.ownerId,
        },
      });
      settingsCreated++;
    }
  }
  console.log(`AgentSettings configured: ${settingsCreated} records across ${projects.length} project(s).`);

  // 2. Populate TaskEmbeddings for all tasks
  const tasks = await prisma.task.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      sequenceId: true,
      project: { select: { identifier: true } },
    },
  });

  console.log(`Generating TaskEmbedding for ${tasks.length} task(s)...`);

  let embeddingsUpserted = 0;
  for (const task of tasks) {
    const text = `[${task.project.identifier}-${task.sequenceId}] ${task.title}\n\n${task.description ?? ""}`.trim();
    const embedding = generateDeterministicEmbedding(text);
    const vectorLiteral = `[${embedding.join(",")}]`;
    const hash = computeContentHash(text);

    await prisma.$executeRaw`
      INSERT INTO "TaskEmbedding" (id, "taskId", embedding, "contentHash", "updatedAt")
      VALUES (${randomUUID()}, ${task.id}, ${vectorLiteral}::vector, ${hash}, now())
      ON CONFLICT ("taskId") DO UPDATE SET embedding = ${vectorLiteral}::vector, "contentHash" = ${hash}, "updatedAt" = now()
    `;
    embeddingsUpserted++;
  }

  console.log(`TaskEmbeddings upserted: ${embeddingsUpserted} embeddings.`);
  console.log("=== Seeding completed successfully ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
