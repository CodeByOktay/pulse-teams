/**
 * Agent-003 (Status Requester) pure logic — Phase 6 Step 6.03 (ADR-034).
 *
 * Staleness detection, quick-response action validation, and the notification /
 * proposal copy used by the interrupt()/resume() LangGraph flow. Tier C principle:
 * this module never mutates task state directly — it only shapes messages and
 * proposal payloads for human-approved mutation.
 */

export const DEFAULT_STALE_DAYS = 3;
export const RESPONSE_TIMEOUT_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type QuickResponseAction = "PROGRESSING" | "BLOCKED" | "COMPLETED";

const QUICK_RESPONSE_ACTIONS: ReadonlySet<string> = new Set<QuickResponseAction>([
  "PROGRESSING",
  "BLOCKED",
  "COMPLETED",
]);

export function isValidQuickAction(value: string): value is QuickResponseAction {
  return QUICK_RESPONSE_ACTIONS.has(value);
}

/** Reads `config.staleDays`; falls back to `DEFAULT_STALE_DAYS` unless it's a positive finite integer. */
export function resolveStaleDays(config: unknown): number {
  const raw = (config as { staleDays?: unknown } | null | undefined)?.staleDays;
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_STALE_DAYS;
}

/** True when whole calendar days elapsed since `lastActivityAt` is >= `staleDays`. */
export function isTaskStale(
  lastActivityAt: Date,
  now: Date,
  staleDays: number = DEFAULT_STALE_DAYS,
): boolean {
  const elapsedDays = Math.floor((now.getTime() - lastActivityAt.getTime()) / MS_PER_DAY);
  return elapsedDays >= staleDays;
}

/** True when whole calendar days elapsed since `createdAt` is >= `timeoutDays`. */
export function hasRequestExpired(
  createdAt: Date,
  now: Date,
  timeoutDays: number = RESPONSE_TIMEOUT_DAYS,
): boolean {
  const elapsedDays = Math.floor((now.getTime() - createdAt.getTime()) / MS_PER_DAY);
  return elapsedDays >= timeoutDays;
}

/** Builds the initial status-request notification/message copy (spec §3.2 item 1). */
export function buildStatusRequestMessage(params: {
  pmName: string;
  taskIdentifier: string;
  taskTitle: string;
  staleDays: number;
}): { title: string; message: string } {
  const { pmName, taskIdentifier, taskTitle, staleDays } = params;
  return {
    title: `${pmName} adına Pulse Asistan`,
    message: `[${taskIdentifier}] "${taskTitle}" görevi ${staleDays} gündür güncellenmedi. Durumu nedir?`,
  };
}

/** Builds the immediate ADMIN escalation notice for a BLOCKED quick response (spec §3.3.2). */
export function buildBlockedEscalationNotice(params: {
  assigneeName: string;
  taskIdentifier: string;
}): { title: string; message: string } {
  const { assigneeName, taskIdentifier } = params;
  const title = `[Acil Engel] ${assigneeName} ${taskIdentifier} görevinde takıldı!`;
  return { title, message: title };
}

/** Builds the ADMIN escalation notice for an expired (2-day non-response) ProgressRequest (spec §3.4). */
export function buildNonResponseEscalationNotice(params: {
  assigneeName: string;
  taskIdentifier: string;
  taskTitle: string;
}): { title: string; message: string } {
  const { assigneeName, taskIdentifier, taskTitle } = params;
  return {
    title: "[Cevapsızlık] Durum Talebi Yanıtlanmadı",
    message: `${assigneeName}, '[${taskIdentifier}] ${taskTitle}' görevi için gönderilen durum talebine 2 gündür yanıt vermedi.`,
  };
}

export const COMPLETION_PROPOSAL_CONFIDENCE = 0.95;

/** Builds the AgentProposal summary for a COMPLETED quick response (spec §3.3.1). */
export function buildCompletionProposalSummary(taskIdentifier: string): string {
  return `[${taskIdentifier}] Kullanıcı görevin tamamlandığını bildirdi. Durumun Tamamlandı'ya çekilmesi öneriliyor.`;
}

/** Builds the AgentProposal blockerDetails for a BLOCKED quick response (spec §3.3.2). */
export function buildBlockerProposalDetails(taskIdentifier: string): string {
  return `[${taskIdentifier}] Kullanıcı engelle karşılaştığını belirtti.`;
}
