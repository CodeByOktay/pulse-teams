import { describe, it, expect, vi } from "vitest";
import { getNextSequenceId } from "../sequence";

describe("sequence utility", () => {
  it("should return 1 when there are no existing tasks for the project", async () => {
    const mockPrismaClient = {
      task: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const nextId = await getNextSequenceId("project-1", mockPrismaClient as any);
    expect(nextId).toBe(1);
    expect(mockPrismaClient.task.findFirst).toHaveBeenCalledWith({
      where: { projectId: "project-1" },
      orderBy: { sequenceId: "desc" },
      select: { sequenceId: true },
    });
  });

  it("should increment sequenceId by 1 when tasks exist", async () => {
    const mockPrismaClient = {
      task: {
        findFirst: vi.fn().mockResolvedValue({ sequenceId: 42 }),
      },
    };

    const nextId = await getNextSequenceId("project-1", mockPrismaClient as any);
    expect(nextId).toBe(43);
  });
});
