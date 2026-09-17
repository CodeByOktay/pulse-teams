import type { Prisma, PrismaClient } from "@prisma/client";

export async function getNextSequenceId(
  projectId: string,
  client: Prisma.TransactionClient | PrismaClient,
): Promise<number> {
  const lastTask = await client.task.findFirst({
    where: { projectId },
    orderBy: { sequenceId: "desc" },
    select: { sequenceId: true },
  });

  return (lastTask?.sequenceId ?? 0) + 1;
}
