/**
 * Agent-009 (Scope Creep Detection) pure logic — Phase 6 Step 6.04 (ADR-034).
 *
 * Compares an ACTIVE sprint's baseline task count (tasks linked at/before
 * `sprint.startDate`) against tasks injected after that point, and flags
 * sprints whose growth rate crosses the configured threshold.
 */

export interface ScopeCreepSprintInput {
  id: string;
  name: string;
  startDate: Date | null;
}

export interface ScopeCreepSprintTaskInput {
  taskId: string;
  addedAt: Date;
}

export const DEFAULT_SCOPE_CREEP_THRESHOLD_PERCENT = 15;
export const DEFAULT_SCOPE_CREEP_MIN_INJECTED_TASKS = 3;

export interface ScopeCreepResult {
  baselineTaskCount: number;
  injectedTaskCount: number;
  injectedTaskIds: string[];
  growthRatePercent: number;
  exceededThreshold: boolean;
}

/** Computes the scope growth rate and threshold verdict for one sprint (spec §3.2). */
export function calculateScopeCreep(
  sprint: ScopeCreepSprintInput,
  sprintTasks: ScopeCreepSprintTaskInput[],
  now: Date,
  thresholdPercent: number = DEFAULT_SCOPE_CREEP_THRESHOLD_PERCENT,
): ScopeCreepResult {
  const startDate = sprint.startDate ?? now;

  const baseline = sprintTasks.filter((task) => task.addedAt.getTime() <= startDate.getTime());
  const injected = sprintTasks.filter((task) => task.addedAt.getTime() > startDate.getTime());

  // Avoid division by zero: an empty-at-start sprint is treated as baseline 1 (spec §3.2.1).
  const baselineTaskCount = baseline.length > 0 ? baseline.length : 1;
  const injectedTaskCount = injected.length;
  const growthRatePercent = (injectedTaskCount / baselineTaskCount) * 100;
  const exceededThreshold =
    growthRatePercent >= thresholdPercent || injectedTaskCount >= DEFAULT_SCOPE_CREEP_MIN_INJECTED_TASKS;

  return {
    baselineTaskCount,
    injectedTaskCount,
    injectedTaskIds: injected.map((task) => task.taskId),
    growthRatePercent,
    exceededThreshold,
  };
}

/** Builds the ADMIN/PM notification copy for a threshold breach (spec §3.3); exact per spec. */
export function buildScopeCreepNotification(params: {
  pmName: string;
  sprintName: string;
  injectedTaskCount: number;
  growthRatePercent: number;
}): { title: string; message: string } {
  const { pmName, sprintName, injectedTaskCount, growthRatePercent } = params;
  return {
    title: `${pmName} adına Pulse Asistan: Kapsam Kayması Uyarısı`,
    message: `'${sprintName}' sprintine başlangıçtan sonra ${injectedTaskCount} yeni görev eklendi (+%${Math.round(growthRatePercent)} artış). Sprint hedefleri riske girebilir.`,
  };
}
