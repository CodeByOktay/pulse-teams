/**
 * Shared TASK_UNBLOCKED dedup (Phase 6 Step 6.08 — ADR-036 §3.4/§B5).
 *
 * Both TASK_UNBLOCKED channels — the immediate, synchronous channel
 * (`triggerUnblockedDependencies`, fired right after a completing mutation)
 * and Agent-004's asynchronous safety-net sweep (`blocker-service.ts`,
 * `dispatchBlockerCheck` -> `verifyUnblockedSafetyNet`) — must agree on
 * whether a task's "unblocked" state has already been announced. Without a
 * shared, transactionally-locked check, a race between the two channels (or
 * two concurrent Agent-004 sweeps) can write duplicate `TASK_UNBLOCKED`
 * activities/notifications for the same task.
 *
 * `claimUnblockAnnouncement` is the single source of truth for that check:
 * it takes a Postgres advisory transaction lock scoped to the task (so only
 * one caller can evaluate/claim the announcement at a time), then reuses the
 * pure `shouldEmitUnblock` / `computeLastBlockedAt` helpers from
 * `blocker-logic.ts` to decide whether a NEW `TASK_UNBLOCKED` activity should
 * be written. Notifications are intentionally NOT sent here — callers only
 * dispatch notifications when this returns `true`, and do so outside the
 * transaction (non-blocking, existing try/catch style).
 */
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { computeLastBlockedAt, shouldEmitUnblock } from "@/lib/blocker-logic";

/**
 * Attempts to claim the right to announce that `taskId` is now unblocked.
 *
 * Returns `true` (and writes the `TASK_UNBLOCKED` activity) only when the
 * task's blocking condition has changed since the last announcement (or it
 * has never been announced before). Returns `false` when a previous
 * announcement is still valid — the caller must skip sending a notification.
 */
export async function claimUnblockAnnouncement(taskId: string, actorId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Serializes concurrent claims for the same task (both channels, and
    // concurrent Agent-004 sweeps) without blocking unrelated tasks.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('unblock:' || ${taskId}))`;

    const lastUnblocked = await tx.activity.findFirst({
      where: { taskId, type: "TASK_UNBLOCKED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const incomingRelations = await tx.taskRelation.findMany({
      where: { targetTaskId: taskId, type: "BLOCKS" },
      select: { sourceTaskId: true, createdAt: true },
    });

    const blockerTaskIds = [...new Set(incomingRelations.map((relation) => relation.sourceTaskId))];

    const blockerStateChanges = await Promise.all(
      blockerTaskIds.map((blockerTaskId) =>
        tx.activity.findFirst({
          where: { taskId: blockerTaskId, type: "TASK_STATE_CHANGED" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ),
    );

    const lastBlockedAt = computeLastBlockedAt({
      relationCreatedAts: incomingRelations.map((relation) => relation.createdAt),
      blockerStateChangedAts: blockerStateChanges
        .filter((activity): activity is { createdAt: Date } => activity !== null)
        .map((activity) => activity.createdAt),
    });

    const emit = shouldEmitUnblock({
      lastUnblockedAt: lastUnblocked?.createdAt ?? null,
      lastBlockedAt,
    });

    if (!emit) return false;

    await logActivity(tx, {
      type: "TASK_UNBLOCKED",
      taskId,
      actorId,
    });

    return true;
  });
}
