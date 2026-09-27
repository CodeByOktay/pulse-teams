"use server";

import { revalidatePath } from "next/cache";
import { requireMembership, requireSession } from "@/lib/authz";
import { getNow } from "@/lib/clock";
import {
  getTodayStandupForUser,
  submitStandupEntry,
} from "@/lib/standup-service";

const MIN_ENTRY_LENGTH = 2;

/**
 * Records the current user's standup entry for today (spec §3.1). Rejects blank
 * "yesterday"/"today" answers and submissions after the 11:30 cut-off (delegated to
 * `submitStandupEntry`).
 */
export async function submitMyStandupEntry(
  projectId: string,
  yesterday: string,
  today: string,
  blockers?: string,
): Promise<void> {
  const session = await requireSession();
  await requireMembership(projectId, session.user.id);

  const trimmedYesterday = yesterday.trim();
  const trimmedToday = today.trim();

  if (trimmedYesterday.length < MIN_ENTRY_LENGTH || trimmedToday.length < MIN_ENTRY_LENGTH) {
    throw new Error("Lütfen \"Dün\" ve \"Bugün\" alanlarını doldurun.");
  }

  await submitStandupEntry(
    {
      projectId,
      userId: session.user.id,
      yesterday: trimmedYesterday,
      today: trimmedToday,
      blockers,
    },
    getNow(),
  );

  revalidatePath(`/projects/${projectId}/board`);
}

export interface StandupBanner {
  isOpen: boolean;
  hasSubmitted: boolean;
  publishedSummary: { summary: string; blockers: string[] } | null;
}

/**
 * Read model for the board's standup banner / summary card (spec §3.2): whether today's
 * standup is open, whether the current user already submitted, and the published team
 * summary once Agent-005 has synthesized it.
 */
export async function getTodayStandupBanner(projectId: string): Promise<StandupBanner> {
  const session = await requireSession();
  await requireMembership(projectId, session.user.id);

  const { standup, hasSubmitted } = await getTodayStandupForUser(
    projectId,
    session.user.id,
    getNow(),
  );

  return {
    isOpen: standup !== null,
    hasSubmitted,
    publishedSummary:
      standup?.summary != null
        ? { summary: standup.summary, blockers: standup.blockers ?? [] }
        : null,
  };
}
