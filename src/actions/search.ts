"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isQueryValid, normalizeSearchQuery, parseTaskIdentifier } from "@/lib/search-logic";
import type { Prisma } from "@prisma/client";

export type TaskSearchResult = {
  id: string;
  title: string;
  sequenceId: number;
  projectId: string;
  projectIdentifier: string;
  stateName: string;
  stateColor: string;
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

  return {
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      sequenceId: task.sequenceId,
      projectId: task.project.id,
      projectIdentifier: task.project.identifier,
      stateName: task.state.name,
      stateColor: task.state.color,
    })),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      identifier: project.identifier,
    })),
  };
}
