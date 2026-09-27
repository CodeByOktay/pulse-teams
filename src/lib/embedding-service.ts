import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getEmbedding } from "@/lib/ai/embeddings";
import {
  buildTaskEmbeddingText,
  computeContentHash,
  shouldRegenerateEmbedding,
  toVectorLiteral,
} from "@/lib/semantic-search";

/**
 * Bir görevin gömme (embedding) vektörünü üretir/günceller. Bu fonksiyon bilinçli olarak
 * "use server" dosyasında DEĞİLDİR: sunucu action'ları tarafından, ilgili mutasyon
 * transaction'ı tamamlandıktan sonra çağrılır (bkz. src/lib/dependency-automation.ts deseni).
 *
 * Dayanıklılık: tüm gövde try/catch içindedir; hata ASLA fırlatılmaz — görev oluşturma/güncelleme
 * akışını bozmamalıdır. AI gömme yapılandırılmamışsa veya çağrı başarısız olursa sessizce no-op olur.
 */
export async function upsertTaskEmbedding(taskId: string): Promise<void> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        description: true,
        sequenceId: true,
        project: { select: { identifier: true } },
      },
    });
    if (!task) return;

    const text = buildTaskEmbeddingText({
      title: task.title,
      description: task.description,
      sequenceId: task.sequenceId,
      projectIdentifier: task.project.identifier,
    });

    const rows = await prisma.$queryRaw<{ contentHash: string }[]>`
      SELECT "contentHash" FROM "TaskEmbedding" WHERE "taskId" = ${taskId}
    `;
    const existingHash = rows[0]?.contentHash;

    if (!shouldRegenerateEmbedding(existingHash, text)) {
      return;
    }

    const embedding = await getEmbedding(text);
    if (!embedding) return;

    const vectorLiteral = toVectorLiteral(embedding);
    const hash = computeContentHash(text);

    await prisma.$executeRaw`
      INSERT INTO "TaskEmbedding" (id, "taskId", embedding, "contentHash", "updatedAt")
      VALUES (${randomUUID()}, ${taskId}, ${vectorLiteral}::vector, ${hash}, now())
      ON CONFLICT ("taskId") DO UPDATE SET embedding = ${vectorLiteral}::vector, "contentHash" = ${hash}, "updatedAt" = now()
    `;
  } catch (err) {
    console.warn("Task embedding upsert error:", err);
  }
}
