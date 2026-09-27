/**
 * Agent-005 (Async Daily Standup) service — Phase 6 Step 6.05 (ADR-034).
 *
 * Session-independent and project-scoped: invoked both by member-facing server actions
 * (`src/actions/standup.ts`) and by the `pulse-agent` container through
 * `POST /api/internal/agent/standup-open` / `standup-synthesize`.
 */
import type { StandupEntry, UserNotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { shouldDeliverWithPreferences, buildSprintNotificationDeepLink } from "@/lib/notification-logic";
import { createNotification } from "@/actions/notification";
import { analyzeStandupText } from "@/lib/ai/standup-interpreter";
import {
  STANDUP_AGENT_KEY,
  getStartOfCalendarDay,
  hasSubmittedStandup,
  isAfterCutoff,
  shouldPublishSummary,
  type StandupEntryInput,
} from "@/lib/standup-logic";

export { STANDUP_AGENT_KEY };

export interface OpenStandupResult {
  opened: boolean;
  standupId: string | null;
}

/**
 * Idempotently opens (or returns the existing) `DailyStandup` row for today. Safe to call
 * repeatedly / at any time of day thanks to the `@@unique([projectId, date])` constraint
 * (spec §3.1 — the 09:30 APScheduler trigger is the primary caller, but member submission
 * also relies on this being callable mid-day).
 */
export async function openTodayStandup(
  projectId: string,
  now: Date = getNow(),
): Promise<OpenStandupResult> {
  const agentSetting = await prisma.agentSettings.findUnique({
    where: { projectId_agentKey: { projectId, agentKey: STANDUP_AGENT_KEY } },
    select: { enabled: true },
  });

  if (agentSetting && !agentSetting.enabled) {
    return { opened: false, standupId: null };
  }

  const date = getStartOfCalendarDay(now);

  const standup = await prisma.dailyStandup.upsert({
    where: { projectId_date: { projectId, date } },
    create: { projectId, date },
    update: {},
  });

  return { opened: true, standupId: standup.id };
}

/**
 * Records (or updates, if resubmitted) a member's standup entry for today. Rejects
 * submissions after the 11:30 Europe/Istanbul cut-off (spec §3.1).
 */
export async function submitStandupEntry(
  params: { projectId: string; userId: string; yesterday: string; today: string; blockers?: string },
  now: Date = getNow(),
): Promise<StandupEntry> {
  const { projectId, userId, yesterday, today, blockers } = params;

  if (isAfterCutoff(now)) {
    throw new Error("Standup için giriş süresi doldu.");
  }

  const { standupId } = await openTodayStandup(projectId, now);
  if (!standupId) {
    throw new Error("Standup özelliği bu proje için etkin değil.");
  }

  return prisma.standupEntry.upsert({
    where: { standupId_userId: { standupId, userId } },
    create: {
      standupId,
      userId,
      yesterday,
      today,
      blockers: blockers?.trim() ? blockers.trim() : null,
    },
    update: {
      yesterday,
      today,
      blockers: blockers?.trim() ? blockers.trim() : null,
    },
  });
}

export interface TodayStandupForUser {
  standup: {
    id: string;
    summary: string | null;
    blockers: string[] | null;
  } | null;
  hasSubmitted: boolean;
}

/**
 * Read model for the board banner / summary card: today's standup (if any was opened) plus
 * whether `userId` has already submitted their entry for it.
 */
export async function getTodayStandupForUser(
  projectId: string,
  userId: string,
  now: Date = getNow(),
): Promise<TodayStandupForUser> {
  const date = getStartOfCalendarDay(now);

  const standup = await prisma.dailyStandup.findUnique({
    where: { projectId_date: { projectId, date } },
    include: { entries: { select: { userId: true } } },
  });

  if (!standup) {
    return { standup: null, hasSubmitted: false };
  }

  return {
    standup: {
      id: standup.id,
      summary: standup.summary,
      blockers: Array.isArray(standup.blockers) ? (standup.blockers as string[]) : null,
    },
    hasSubmitted: hasSubmittedStandup(standup.entries, userId),
  };
}

export interface SynthesizeStandupResult {
  entryCount: number;
  published: boolean;
}

/**
 * 11:30 cut-off trigger (spec §3.1): synthesizes all of today's standup entries into a
 * team-level summary (LLM or heuristic fallback), persists it, and notifies the team.
 * Idempotent — a standup whose `summary` is already set is never re-synthesized.
 */
export async function synthesizeStandup(
  projectId: string,
  now: Date = getNow(),
): Promise<SynthesizeStandupResult> {
  const date = getStartOfCalendarDay(now);

  const standup = await prisma.dailyStandup.findUnique({
    where: { projectId_date: { projectId, date } },
    include: {
      entries: { include: { user: { select: { id: true, name: true } } } },
      project: { select: { id: true, name: true, members: { select: { userId: true } } } },
    },
  });

  if (!standup) {
    return { entryCount: 0, published: false };
  }

  if (standup.summary !== null) {
    return { entryCount: standup.entries.length, published: false };
  }

  if (!shouldPublishSummary(standup.entries.length)) {
    return { entryCount: 0, published: false };
  }

  const entryInputs: StandupEntryInput[] = standup.entries.map((entry) => ({
    userId: entry.userId,
    userName: entry.user.name ?? "Bilinmeyen Üye",
    yesterday: entry.yesterday,
    today: entry.today,
    blockers: entry.blockers,
  }));

  const synthesis = await analyzeStandupText({
    entries: entryInputs,
    projectName: standup.project.name,
  });

  await prisma.dailyStandup.update({
    where: { id: standup.id },
    data: { summary: synthesis.summary, blockers: synthesis.blockers },
  });

  const link = buildSprintNotificationDeepLink(projectId);
  const title = "Günlük Standup Özeti Yayınlandı";
  const message =
    synthesis.blockers.length > 0
      ? `Bugünün ekip özeti yayınlandı. ${synthesis.blockers.length} engel raporlandı.`
      : "Bugünün ekip özeti yayınlandı.";

  const preferenceCache = new Map<string, UserNotificationPreference | null>();
  const getPreferences = async (userId: string) => {
    if (!preferenceCache.has(userId)) {
      preferenceCache.set(
        userId,
        await prisma.userNotificationPreference.findUnique({ where: { userId } }),
      );
    }
    return preferenceCache.get(userId) ?? null;
  };

  for (const member of standup.project.members) {
    const preferences = await getPreferences(member.userId);
    if (
      !shouldDeliverWithPreferences({
        actorId: null,
        recipientId: member.userId,
        type: "STANDUP_SUMMARY_PUBLISHED",
        preferences,
      })
    ) {
      continue;
    }

    await createNotification({
      type: "STANDUP_SUMMARY_PUBLISHED",
      title,
      message,
      link,
      actorId: null,
      userId: member.userId,
    });
  }

  return { entryCount: standup.entries.length, published: true };
}
