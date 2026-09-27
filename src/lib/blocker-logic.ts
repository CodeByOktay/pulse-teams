/**
 * Agent-004 (Blocker Manager) pure logic — Phase 6 Step 6.04 (ADR-034).
 *
 * Analyzes `TaskRelation` rows of type BLOCKS ("Task A blockingTaskId BLOCKS
 * Task B blockedTaskId") for overdue and stale blockers, and verifies whether
 * a task is fully unblocked (all its blockers completed).
 */

export interface BlockerRelationInput {
  blockingTaskId: string;
  blockedTaskId: string;
}

export interface BlockerTaskInput {
  id: string;
  stateGroup: string;
  dueDate: Date | null;
  updatedAt: Date;
}

export type BlockerFindingType = "overdueBlocker" | "staleBlocker";

export interface BlockerFinding {
  type: BlockerFindingType;
  blockingTaskId: string;
  blockedTaskId: string;
}

export const STALE_BLOCKER_DAYS = 2;
export const STALE_BLOCKER_WAITING_GROUPS = ["TODO", "IN_PROGRESS"] as const;
export const STALE_BLOCKER_TITLE = "[Darboğaz Uyarısı] Bağımlılık Zinciri Tıkandı";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Evaluates the overdueBlocker + staleBlocker rules (spec §2.2) for every BLOCKS relation. */
export function analyzeBlockerChain(
  relations: BlockerRelationInput[],
  tasks: BlockerTaskInput[],
  now: Date,
): BlockerFinding[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const findings: BlockerFinding[] = [];

  for (const relation of relations) {
    const blocking = taskById.get(relation.blockingTaskId);
    const blocked = taskById.get(relation.blockedTaskId);
    if (!blocking || !blocked) continue;
    if (blocking.stateGroup === "DONE") continue; // resolved; not a blocker finding

    if (blocking.dueDate && blocking.dueDate.getTime() < now.getTime()) {
      findings.push({
        type: "overdueBlocker",
        blockingTaskId: blocking.id,
        blockedTaskId: blocked.id,
      });
    }

    const daysSinceUpdate = (now.getTime() - blocking.updatedAt.getTime()) / MS_PER_DAY;
    const blockedIsWaiting = (STALE_BLOCKER_WAITING_GROUPS as readonly string[]).includes(blocked.stateGroup);
    if (daysSinceUpdate > STALE_BLOCKER_DAYS && blockedIsWaiting) {
      findings.push({
        type: "staleBlocker",
        blockingTaskId: blocking.id,
        blockedTaskId: blocked.id,
      });
    }
  }

  return findings;
}

/** True when every relation blocking `taskId` points at a completed task (spec §2.2.3). */
export function isFullyUnblocked(
  taskId: string,
  allBlockingRelations: BlockerRelationInput[],
  completedTaskIds: Set<string> | string[],
): boolean {
  const completed = completedTaskIds instanceof Set ? completedTaskIds : new Set(completedTaskIds);
  const blockers = allBlockingRelations.filter((relation) => relation.blockedTaskId === taskId);
  return blockers.every((relation) => completed.has(relation.blockingTaskId));
}

export interface BlockerTaskRef {
  identifier: string;
  title: string;
}

/** Builds the notification copy for one finding (spec §2.2); title/message are exact per spec. */
export function buildBlockerNotification(params: {
  pmName: string;
  type: BlockerFindingType;
  blockingTask: BlockerTaskRef;
  blockedTask: BlockerTaskRef;
}): { title: string; message: string } {
  const { pmName, type, blockingTask, blockedTask } = params;

  if (type === "overdueBlocker") {
    return {
      title: `${pmName} adına Pulse Asistan: Engelleyen Görev Gecikti!`,
      message: `'[${blockedTask.identifier}] ${blockedTask.title}' görevinizi engelleyen '[${blockingTask.identifier}] ${blockingTask.title}' görevinin teslim tarihi geçti. Gecikme riski mevcut.`,
    };
  }

  return {
    title: STALE_BLOCKER_TITLE,
    message: `'[${blockingTask.identifier}] ${blockingTask.title}' görevi 2 gündür güncellenmediği için '[${blockedTask.identifier}] ${blockedTask.title}' görevi ilerleyemiyor.`,
  };
}

// ---------------------------------------------------------------------------
// TASK_UNBLOCKED dedup (Step 6.08, ADR-036 §B5)
// ---------------------------------------------------------------------------

export interface UnblockCheckInput {
  lastUnblockedAt: Date | null | undefined;
  lastBlockedAt: Date | null | undefined;
}

/**
 * Shared dedup for both TASK_UNBLOCKED channels (Phase 5 `triggerUnblockedDependencies`
 * and Agent-004 `blocker-service`). A task is announced as unblocked again only when its
 * blocking condition changed after the last announcement.
 */
export function shouldEmitUnblock(input: UnblockCheckInput): boolean {
  if (!input.lastBlockedAt) return false;
  if (!input.lastUnblockedAt) return true;
  return input.lastBlockedAt.getTime() > input.lastUnblockedAt.getTime();
}

/**
 * Latest moment the blocking condition of a task changed: a new incoming BLOCKS
 * relation, or a state transition of one of its blockers (e.g. DONE -> reopened ->
 * DONE again). Returns null when there is nothing to compare.
 */
export function computeLastBlockedAt(params: {
  relationCreatedAts: Date[];
  blockerStateChangedAts: Date[];
}): Date | null {
  let latest: number | null = null;
  for (const date of [...params.relationCreatedAts, ...params.blockerStateChangedAts]) {
    const time = date.getTime();
    if (latest === null || time > latest) latest = time;
  }
  return latest === null ? null : new Date(latest);
}
