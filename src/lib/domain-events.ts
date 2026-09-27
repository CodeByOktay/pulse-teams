/**
 * DomainEvent outbox writer (Phase 6 — ADR-034).
 *
 * Server actions append events inside their `$transaction`; the Python
 * `pulse-agent` container consumes PENDING rows with `FOR UPDATE SKIP LOCKED`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DomainEventType =
  | "TASK_CREATED"
  | "TASK_STATE_CHANGED"
  | "TASK_SPRINT_ADDED"
  | "TASK_SPRINT_REMOVED"
  | "TASK_COMPLETED"
  | "TASK_DUE_DATE_CHANGED"
  | "TASK_ASSIGNEE_ADDED"
  | "TASK_ASSIGNEE_REMOVED"
  | "SPRINT_STARTED"
  | "SPRINT_COMPLETED";

export interface DomainEventPayload {
  projectId: string;
  taskId?: string;
  sprintId?: string;
  actorId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  [key: string]: unknown;
}

/**
 * Creates a DomainEvent row using a transaction client or the Prisma client.
 * Non-blocking: a write failure is logged and `null` is returned so the
 * primary operation is never aborted.
 */
export async function emitDomainEvent(
  tx: Prisma.TransactionClient | typeof prisma,
  type: DomainEventType | string,
  payload: DomainEventPayload,
) {
  try {
    return await tx.domainEvent.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });
  } catch (error) {
    console.error(`[DomainEvent Error] Failed to emit event ${type}:`, error);
    return null;
  }
}
