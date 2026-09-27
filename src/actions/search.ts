"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isQueryValid, normalizeSearchQuery, parseTaskIdentifier } from "@/lib/search-logic";
import { getEmbedding } from "@/lib/ai/embeddings";
import {
  clampSimilarity,
  mergeHybridResults,
  toVectorLiteral,
  SIMILARITY_THRESHOLD,
} from "@/lib/semantic-search";
import type { Prisma } from "@prisma/client";

export type TaskSearchResult = {
  id: string;
  title: string;
  sequenceId: number;
  projectId: string;
  projectIdentifier: string;
  stateName: string;
  stateColor: string;
  similarity?: number;
};

export type ProjectSearchResult = {
  id: string;
  name: string;
  identifier: string;
};

export type GlobalSearchResult = {
  tasks: TaskSearchResult[];
  projects: ProjectSearchResult[];
};

export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  if (!isQueryValid(query)) {
    return { tasks: [], projects: [] };
  }

  const userId = session.user.id;
  const normalized = normalizeSearchQuery(query);
  const identifierMatch = parseTaskIdentifier(normalized);

  const taskOr: Prisma.TaskWhereInput[] = [{ title: { contains: normalized, mode: "insensitive" } }];
  if (identifierMatch) {
    taskOr.push({
      project: { identifier: identifierMatch.projectIdentifier },
      sequenceId: identifierMatch.sequenceId,
    });
  }

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        project: { members: { some: { userId } } },
        OR: taskOr,
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: {
        project: { select: { id: true, identifier: true } },
        state: { select: { name: true, color: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        members: { some: { userId } },
        OR: [
          { name: { contains: normalized, mode: "insensitive" } },
          { identifier: { contains: normalized, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, identifier: true },
    }),
  ]);

  const textTaskResults: TaskSearchResult[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    sequenceId: task.sequenceId,
    projectId: task.project.id,
    projectIdentifier: task.project.identifier,
    stateName: task.state.name,
    stateColor: task.state.color,
  }));

  // Semantik (vektör) eşleşmeler: AI gömme yapılandırılmamışsa veya çağrı/sorgu başarısız olursa,
  // davranış tamamen mevcut metin-eşleşme sonuçlarına geri döner (sıfır-hata heuristic fallback).
  let mergedTasks = textTaskResults;
  const queryEmbedding = await getEmbedding(normalized);
  if (queryEmbedding) {
    try {
      const vectorLiteral = toVectorLiteral(queryEmbedding);
      const vectorRows = await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          sequenceId: number;
          projectId: string;
          projectIdentifier: string;
          stateName: string;
          stateColor: string;
          similarity: number;
        }>
      >`
        SELECT t.id, t.title, t."sequenceId", t."projectId", p.identifier AS "projectIdentifier",
               s.name AS "stateName", s.color AS "stateColor",
               1 - (e.embedding <=> ${vectorLiteral}::vector) AS similarity
        FROM "TaskEmbedding" e
        JOIN "Task" t ON t.id = e."taskId"
        JOIN "Project" p ON p.id = t."projectId"
        JOIN "State" s ON s.id = t."stateId"
        WHERE e.embedding IS NOT NULL
          AND EXISTS (SELECT 1 FROM "ProjectMember" pm WHERE pm."projectId" = t."projectId" AND pm."userId" = ${userId})
        ORDER BY similarity DESC
        LIMIT 10
      `;

      const vectorTaskResults: (TaskSearchResult & { similarity: number })[] = vectorRows.map(
        (row) => ({
          id: row.id,
          title: row.title,
          sequenceId: row.sequenceId,
          projectId: row.projectId,
          projectIdentifier: row.projectIdentifier,
          stateName: row.stateName,
          stateColor: row.stateColor,
          similarity: clampSimilarity(row.similarity),
        }),
      );

      mergedTasks = mergeHybridResults(textTaskResults, vectorTaskResults, SIMILARITY_THRESHOLD).slice(
        0,
        10,
      );
    } catch (err) {
      console.warn("Semantic search vector query error:", err);
      mergedTasks = textTaskResults;
    }
  }

  return {
    tasks: mergedTasks,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      identifier: project.identifier,
    })),
  };
}
