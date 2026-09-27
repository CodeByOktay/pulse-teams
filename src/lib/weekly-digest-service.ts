/**
 * Agent-006 (Weekly Sprint Digest) service — Phase 6 Step 6.05 (ADR-034).
 *
 * Session-independent and project-scoped: invoked by the `pulse-agent` container
 * through `POST /api/internal/agent/weekly-digest` (Friday 17:00 Europe/Istanbul, spec §4.1).
 */
import type { UserNotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { shouldDeliverWithPreferences, formatNotificationSnippet } from "@/lib/notification-logic";
import { getStartOfCalendarDay, resolvePmName } from "@/lib/deadline-tracker-logic";
import { createNotification } from "@/actions/notification";
import { analyzeWeeklyDigest } from "@/lib/ai/weekly-digest-interpreter";
import {
  WEEKLY_DIGEST_AGENT_KEY,
  WEEKLY_DIGEST_TIME_ZONE,
  calculateWeeklyMetrics,
  formatWeeklyDigestMarkdown,
  getWeekNumber,
  resolveSprintHealthStatus,
  shouldSkipDigest,
  type WeeklyTaskInput,
} from "@/lib/weekly-digest-logic";

export { WEEKLY_DIGEST_AGENT_KEY };

export interface WeeklyDigestResult {
  sent: boolean;
  healthStatus: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Türkiye has observed a fixed UTC+3 offset (no DST) since 2016 — same rationale as
// `standup-logic.ts`'s `addWallClockOffset`, so subtracting whole days from the
// Istanbul start-of-day instant to reach Monday is safe and DST-proof.
function getWeekStart(now: Date): Date {
  const startOfToday = getStartOfCalendarDay(now, WEEKLY_DIGEST_TIME_ZONE);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: WEEKLY_DIGEST_TIME_ZONE,
    weekday: "short",
  }).format(now);
  const weekdayIndex: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offsetDays = weekdayIndex[weekdayName] ?? 0;
  return new Date(startOfToday.getTime() - offsetDays * MS_PER_DAY);
}

const RECENT_SPRINT_COUNT = 10;
const DIGEST_TITLE = "Haftalık Sprint Özeti Yayınlandı";

/**
 * Compiles the weekly digest for the project's active sprint (highlights, priorities, and a
 * deterministic health verdict) and notifies ADMINs + the configured PM. No-op (and never
 * throws for business reasons) when Agent-006 is disabled, there is no active sprint, or a
 * digest was already sent this week.
 */
export async function dispatchWeeklyDigest(
  projectId: string,
  now: Date = getNow(),
): Promise<WeeklyDigestResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: WEEKLY_DIGEST_AGENT_KEY },
        include: { pmUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const agentSetting = project.agentSettings[0];
  if (agentSetting && !agentSetting.enabled) {
    return { sent: false, healthStatus: null };
  }

  const sprint = await prisma.sprint.findFirst({
    where: { projectId, status: "ACTIVE" },
    select: { id: true, name: true, endDate: true },
  });

  if (!sprint) {
    return { sent: false, healthStatus: null };
  }

  const weekStart = getWeekStart(now);
  const weekEnd = now;

  const sprintTaskRows = await prisma.sprintTask.findMany({
    where: { sprintId: sprint.id },
    select: {
      task: {
        select: {
          id: true,
          updatedAt: true,
          dueDate: true,
          state: { select: { group: true } },
        },
      },
    },
  });

  const tasks: WeeklyTaskInput[] = sprintTaskRows.map((row) => ({
    id: row.task.id,
    stateGroup: row.task.state.group,
    completedAt: row.task.state.group === "DONE" ? row.task.updatedAt : null,
    dueDate: row.task.dueDate,
  }));

  const recentSprints = await prisma.sprint.findMany({
    where: { projectId, status: "COMPLETED" },
    select: {
      id: true,
      endDate: true,
      updatedAt: true,
      tasks: { select: { task: { select: { state: { select: { group: true } } } } } },
    },
  });

  const recentVelocities = recentSprints
    .sort((a, b) => {
      const aTime = (a.endDate ?? a.updatedAt).getTime();
      const bTime = (b.endDate ?? b.updatedAt).getTime();
      return bTime - aTime;
    })
    .slice(0, RECENT_SPRINT_COUNT)
    .reverse()
    .map(
      (s) =>
        s.tasks.filter(
          (sprintTask) =>
            sprintTask.task.state.group === "DONE" || sprintTask.task.state.group === "CANCELLED",
        ).length,
    );

  const metrics = calculateWeeklyMetrics({
    tasks,
    weekStart,
    weekEnd,
    sprint: { name: sprint.name, endDate: sprint.endDate },
    recentVelocities,
  });

  if (shouldSkipDigest(metrics)) {
    return { sent: false, healthStatus: null };
  }

  const healthStatus = resolveSprintHealthStatus(metrics);
  const weekNumber = getWeekNumber(weekEnd);

  const adminUsers = project.members.map((member) => member.user);
  const recipients = new Map<string, { id: string; name: string | null }>();
  for (const admin of adminUsers) {
    recipients.set(admin.id, admin);
  }
  if (agentSetting?.pmUser) {
    recipients.set(agentSetting.pmUser.id, agentSetting.pmUser);
  }
  const recipientIds = [...recipients.keys()];

  const alreadySentThisWeek = await prisma.notification.findFirst({
    where: {
      userId: { in: recipientIds },
      type: "WEEKLY_DIGEST_PUBLISHED",
      title: DIGEST_TITLE,
      createdAt: { gte: weekStart },
    },
  });

  if (alreadySentThisWeek) {
    return { sent: false, healthStatus };
  }

  const digest = await analyzeWeeklyDigest({
    metrics,
    projectName: project.name,
    weekNumber,
    healthStatus,
  });

  const markdown = formatWeeklyDigestMarkdown({
    weekNumber,
    healthStatus,
    metrics,
    highlights: digest.highlights,
    nextWeekPriorities: digest.nextWeekPriorities,
  });

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
  const link = `/projects/${projectId}/sprints`;
  const message = `${pmName} adına Pulse Asistan: ${formatNotificationSnippet(markdown, 300)}`;

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

  for (const recipientId of recipientIds) {
    const preferences = await getPreferences(recipientId);
    if (
      !shouldDeliverWithPreferences({
        actorId: null,
        recipientId,
        type: "WEEKLY_DIGEST_PUBLISHED",
        preferences,
      })
    ) {
      continue;
    }

    await createNotification({
      type: "WEEKLY_DIGEST_PUBLISHED",
      title: DIGEST_TITLE,
      message,
      link,
      actorId: null,
      userId: recipientId,
    });
  }

  // Activity.taskId is a required field and there is no sprint/project-level activity
  // concept in the schema for a digest that spans many tasks — Notification is sufficient
  // (deliberate scope limitation, see Step 6.05 backend spec).
  return { sent: true, healthStatus };
}
