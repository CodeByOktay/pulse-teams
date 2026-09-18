import type { Priority } from "@prisma/client";

export type BoardLabel = { id: string; name: string; color: string };
export type BoardAssignee = { id: string; name: string };

export type BoardTask = {
  id: string;
  sequenceId: number;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  sortOrder: number;
  stateId: string;
  labels: BoardLabel[];
  assignees: BoardAssignee[];
};

export type BoardState = {
  id: string;
  name: string;
  color: string;
  sequence: number;
  isDefault: boolean;
  tasks: BoardTask[];
};

export type BoardProject = {
  id: string;
  name: string;
  identifier: string;
};
