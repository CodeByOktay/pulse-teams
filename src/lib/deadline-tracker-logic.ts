/**
 * Agent-001 (Deadline Tracker) pure logic — Phase 6 Step 6.02 (ADR-034).
 *
 * Calendar-day math is done in the agent time zone (Europe/Istanbul) rather than
 * the server's local zone, so the Next.js container's TZ never shifts thresholds.
 */

export const DEADLINE_TRACKER_AGENT_KEY = "agent-001";
export const DEADLINE_TRACKER_TIME_ZONE = "Europe/Istanbul";
export const ESCALATION_TITLE = "[Eskalasyon] Geciken Görev Uyarısı";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function getZonedParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Midnight (00:00) of `now`'s calendar day in `timeZone`, as an absolute instant. */
export function getStartOfCalendarDay(now: Date, timeZone: string = DEADLINE_TRACKER_TIME_ZONE): Date {
  const p = getZonedParts(now, timeZone);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMs = wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - offsetMs);
}

/** Whole calendar days from `now` to `dueDate` in `timeZone` (negative = overdue). */
export function getCalendarDaysRemaining(
  dueDate: Date,
  now: Date,
  timeZone: string = DEADLINE_TRACKER_TIME_ZONE,
): number {
  const due = getZonedParts(dueDate, timeZone);
  const today = getZonedParts(now, timeZone);
  const diff =
    Date.UTC(due.year, due.month - 1, due.day) - Date.UTC(today.year, today.month - 1, today.day);
  return Math.round(diff / MS_PER_DAY);
}

/** Agent-001 acts on 3 days left, 1 day left, due today and overdue tasks only. */
export function shouldProcessDeadline(daysRemaining: number): boolean {
  return daysRemaining === 3 || daysRemaining === 1 || daysRemaining <= 0;
}

export function isOverdue(daysRemaining: number): boolean {
  return daysRemaining < 0;
}

export function resolvePmName(
  pmUserName: string | null | undefined,
  ownerName: string | null | undefined,
): string {
  return pmUserName?.trim() || ownerName?.trim() || "Proje Yöneticisi";
}

export function buildDeadlineReminder(params: {
  pmName: string;
  taskIdentifier: string;
  taskTitle: string;
  daysRemaining: number;
}): { title: string; message: string } {
  const { pmName, taskIdentifier, taskTitle, daysRemaining } = params;
  const subject = `[${taskIdentifier}] ${taskTitle}`;

  if (daysRemaining < 0) {
    return {
      title: `${pmName} adına Pulse Asistan (Gecikme)`,
      message: `${subject} görevinin teslim tarihi ${Math.abs(daysRemaining)} gün geçti.`,
    };
  }

  if (daysRemaining === 0) {
    return {
      title: `${pmName} adına Pulse Asistan (Acil)`,
      message: `${subject} görevi bugün teslim edilmeli!`,
    };
  }

  if (daysRemaining === 1) {
    return {
      title: `${pmName} adına Pulse Asistan`,
      message: `${subject} görevinin teslimine 1 gün kaldı! Lütfen durumunu kontrol edin.`,
    };
  }

  return {
    title: `${pmName} adına Pulse Asistan`,
    message: `${subject} görevinin teslimine ${daysRemaining} gün kaldı.`,
  };
}

export function buildEscalationNotice(params: {
  taskIdentifier: string;
  taskTitle: string;
  daysOverdue: number;
  assigneeNames: string[];
}): { title: string; message: string } {
  const { taskIdentifier, taskTitle, daysOverdue, assigneeNames } = params;
  const names = assigneeNames.length > 0 ? assigneeNames.join(", ") : "Atanan yok";
  return {
    title: ESCALATION_TITLE,
    message: `[${taskIdentifier}] ${taskTitle} görevi ${daysOverdue} gün gecikti. Atananlar: ${names}`,
  };
}

// ---------------------------------------------------------------------------
// Dashboard "Agent Aktiviteleri" summary
// ---------------------------------------------------------------------------

export interface AgentRunSummaryInput {
  status: string;
  scheduledFor: Date;
  startedAt: Date;
  completedAt: Date | null;
  result: unknown;
}

export interface AgentActivitySummary {
  runCount: number;
  remindersSent: number;
  escalationsSent: number;
  lastRun: { status: string; at: Date } | null;
}

function readCount(result: unknown, key: string): number {
  if (!result || typeof result !== "object" || Array.isArray(result)) return 0;
  const value = (result as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Aggregates Agent-001 run results; `lastRun` is the most recently started run. */
export function summarizeAgentRuns(runs: AgentRunSummaryInput[]): AgentActivitySummary {
  let remindersSent = 0;
  let escalationsSent = 0;
  let latest: AgentRunSummaryInput | null = null;

  for (const run of runs) {
    remindersSent += readCount(run.result, "remindersSent");
    escalationsSent += readCount(run.result, "escalationsSent");
    if (!latest || run.startedAt.getTime() > latest.startedAt.getTime()) {
      latest = run;
    }
  }

  return {
    runCount: runs.length,
    remindersSent,
    escalationsSent,
    lastRun: latest ? { status: latest.status, at: latest.completedAt ?? latest.startedAt } : null,
  };
}
