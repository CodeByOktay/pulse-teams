"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId, requireMembership } from "@/lib/authz";
import { clampSimilarity, filterBySimilarityThreshold } from "@/lib/semantic-search";

export type SimilarTaskResult = {
  id: string;
  title: string;
  sequenceId: number;
  stateName: string;
  stateColor: string;
  similarity: number;
};

/**
 * Verilen göreve pgvector kosinüs benzerliğine göre en yakın görevleri döndürür (aynı projeden,
 * eşik üzerinde). Destekleyici bir UI özelliğidir — kritik yol değildir; herhangi bir DB hatası
 * durumunda boş dizi döner, asla fırlatmaz (requireUserId/requireMembership hataları hariç).
 */
export async function getSimilarTasks(taskId: string): Promise<SimilarTaskResult[]> {
  const userId = await requireUserId();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  await requireMembership(task.projectId, userId);

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        sequenceId: number;
        stateName: string;
        stateColor: string;
        similarity: number;
      }>
    >`
      SELECT t.id, t.title, t."sequenceId", s.name AS "stateName", s.color AS "stateColor",
             1 - (e.embedding <=> src.embedding) AS similarity
      FROM "TaskEmbedding" e
      JOIN "Task" t ON t.id = e."taskId"
      JOIN "State" s ON s.id = t."stateId"
      CROSS JOIN (SELECT embedding FROM "TaskEmbedding" WHERE "taskId" = ${taskId}) src
      WHERE t."projectId" = ${task.projectId}
        AND t.id != ${taskId}
        AND e.embedding IS NOT NULL
        AND src.embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT 10
    `;

    const clamped = rows.map((row) => ({ ...row, similarity: clampSimilarity(row.similarity) }));
    return filterBySimilarityThreshold(clamped);
  } catch (err) {
    console.warn("Similar tasks query error:", err);
    return [];
  }
}
