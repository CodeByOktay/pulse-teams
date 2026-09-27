/**
 * Agent-002 (Task Hygiene) pure logic — Phase 6 Step 6.03 (ADR-034).
 *
 * Zero-LLM-token rule engine: scans active tasks (state group not in
 * ['DONE', 'CANCELLED']) for unassigned / missing-due-date / insufficient-description
 * defects and produces the per-project hygiene summary + notification copy.
 */

export const MIN_DESCRIPTION_LENGTH = 20;

export interface HygieneTaskInput {
  id: string;
  stateGroup: string;
  assigneeCount: number;
  dueDate: Date | null;
  description: string | null;
}

export interface HygieneDefects {
  unassigned: boolean;
  missingDueDate: boolean;
  insufficientDescription: boolean;
}

/** Evaluates the 3 hygiene defect rules (spec §2.2) for a single task. */
export function evaluateTaskHygiene(task: HygieneTaskInput): HygieneDefects {
  const unassigned = task.stateGroup !== "BACKLOG" && task.assigneeCount === 0;

  const missingDueDate =
    (task.stateGroup === "TODO" || task.stateGroup === "IN_PROGRESS") && task.dueDate === null;

  const insufficientDescription =
    task.stateGroup !== "BACKLOG" &&
    (task.description == null || task.description.trim().length < MIN_DESCRIPTION_LENGTH);

  return { unassigned, missingDueDate, insufficientDescription };
}

export function hasAnyHygieneDefect(defects: HygieneDefects): boolean {
  return defects.unassigned || defects.missingDueDate || defects.insufficientDescription;
}

export interface HygieneSummary {
  unassigned: number;
  missingDueDate: number;
  insufficientDescription: number;
  /** Count of DISTINCT tasks with >= 1 defect (not a sum of the three counters). */
  total: number;
}

/** Aggregates defect counts across a set of tasks; `total` de-duplicates multi-defect tasks. */
export function summarizeHygiene(tasks: HygieneTaskInput[]): HygieneSummary {
  let unassigned = 0;
  let missingDueDate = 0;
  let insufficientDescription = 0;
  let total = 0;

  for (const task of tasks) {
    const defects = evaluateTaskHygiene(task);
    if (defects.unassigned) unassigned += 1;
    if (defects.missingDueDate) missingDueDate += 1;
    if (defects.insufficientDescription) insufficientDescription += 1;
    if (hasAnyHygieneDefect(defects)) total += 1;
  }

  return { unassigned, missingDueDate, insufficientDescription, total };
}

/** Builds the hygiene report notification copy (spec §2.3); `null` when the project is clean. */
export function buildHygieneReportNotification(params: {
  pmName: string;
  summary: HygieneSummary;
  projectId: string;
}): { title: string; message: string; link: string } | null {
  const { pmName, summary, projectId } = params;

  if (summary.total === 0) return null;

  return {
    title: `${pmName} adına Pulse Asistan: Görev Hijyeni Raporu`,
    message: `${summary.total} görevde eksiklik tespit edildi (Atanmamış: ${summary.unassigned}, Tarihsiz: ${summary.missingDueDate}, Açıklamasız: ${summary.insufficientDescription}). Lütfen panoyu gözden geçirin.`,
    link: `/projects/${projectId}/board`,
  };
}
