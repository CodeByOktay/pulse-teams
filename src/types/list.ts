import type { Priority } from "@prisma/client";
import type { BoardAssignee, BoardLabel } from "@/types/board";

export type ListState = { id: string; name: string; color: string; sequence: number };

export type ListTask = {
  id: string;
  sequenceId: number;
  title: string;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  stateId: string;
  state: ListState;
  labels: BoardLabel[];
  assignees: BoardAssignee[];
};
