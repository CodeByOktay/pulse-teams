/**
 * Agent-008 (Sprint Assistant) service — Phase 6 Step 6.06 (ADR-034).
 *
 * Two independent, session-independent entry points invoked by the `pulse-agent`
 * container: `dispatchSprintOverflowCheck` (scheduled daily sweep, spec §3.1) and
 * `dispatchSprintRetro` (event-driven off `SPRINT_COMPLETED`, spec §3.2). Both are
 * idempotent against catch-up re-runs via a `Notification.link`-based dedup check.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { formatNotificationSnippet } from "@/lib/notification-logic";
import { resolvePmName } from "@/lib/deadline-tracker-logic";
import { createNotifications } from "@/actions/notification";
import { analyzeSprintRetro } from "@/lib/ai/sprint-retro-interpreter";
import { analyzeBlockerChain, type BlockerRelationInput, type BlockerTaskInput } from "@/lib/blocker-logic";
import { calculateScopeCreep, type ScopeCreepSprintTaskInput } from "@/lib/scope-creep-logic";
import {
  SPRINT_ASSISTANT_AGENT_KEY,
  OVERFLOW_WARNING_DAYS_BEFORE_END,
  calculateDailyVelocity,
  predictSprintOverflow,
  shouldTriggerOverflowWarning,
  formatOverflowWarning,
  type SprintAssistantTaskInput,
  type SprintRetroAggregateInput,
} from "@/lib/sprint-assistant-logic";

export { SPRINT_ASSISTANT_AGENT_KEY };

export interface SprintOverflowCheckResult {
  warned: boolean;
}

export interface SprintRetroDispatchResult {
  published: boolean;
}

function buildSprintDedupLink(projectId: string, sprintId: string): string {
  return `/projects/${projectId}/sprints?sprint=${sprintId}`;
}

async function loadProjectForSprintAssistant(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: SPRINT_ASSISTANT_AGENT_KEY },
        include: { pmUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  return project;
}

function resolveRecipientIds(
  project: { members: { userId: string }[] },
  agentSetting: { pmUser: { id: string } | null } | undefined,
): string[] {
  const recipientIds = new Set<string>(project.members.map((member) => member.userId));
  if (agentSetting?.pmUser) {
    recipientIds.add(agentSetting.pmUser.id);
  }
  return [...recipientIds];
}

/**
 * Fires 2 calendar days before an ACTIVE sprint's end date (spec §3.1) when the team's
 * daily completion velocity projects that not all remaining tasks will be finished in time.
 */
export async function dispatchSprintOverflowCheck(
  projectId: string,
  now: Date = getNow(),
): Promise<SprintOverflowCheckResult> {
  const project = await loadProjectForSprintAssistant(projectId);

  const agentSetting = project.agentSettings[0];
  if (agentSetting && !agentSetting.enabled) {
    return { warned: false };
  }

  const sprint = await prisma.sprint.findFirst({
    where: { projectId, status: "ACTIVE" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  if (!sprint || !sprint.endDate) {
    return { warned: false };
  }

  if (!shouldTriggerOverflowWarning(sprint.endDate, now)) {
    return { warned: false };
  }

  const link = buildSprintDedupLink(projectId, sprint.id);
  const alreadyWarned = await prisma.notification.findFirst({
    where: { type: "SPRINT_OVERFLOW_WARNING", link },
    select: { id: true },
  });
  if (alreadyWarned) {
    return { warned: false };
  }

  const sprintTaskRows = await prisma.sprintTask.findMany({
    where: { sprintId: sprint.id },
    select: {
      task: { select: { id: true, updatedAt: true, state: { select: { group: true } } } },
    },
  });

  const tasks: SprintAssistantTaskInput[] = sprintTaskRows.map((row) => ({
    id: row.task.id,
    stateGroup: row.task.state.group,
    updatedAt: row.task.updatedAt,
  }));

  const notDoneTaskCount = tasks.filter((task) => task.stateGroup !== "DONE").length;
  const sprintStartDate = sprint.startDate ?? now;
  const dailyVelocity = calculateDailyVelocity({ sprintStartDate, now, tasks });

  const prediction = predictSprintOverflow({
    remainingDays: OVERFLOW_WARNING_DAYS_BEFORE_END,
    notDoneTaskCount,
    dailyVelocity,
  });

  if (!prediction.atRisk) {
    return { warned: false };
  }

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
  const title = `${pmName} adına Pulse Asistan: Sprint Taşma Uyarısı`;
  const message = formatOverflowWarning({
    sprintName: sprint.name,
    remainingCount: notDoneTaskCount,
    atRiskCount: prediction.projectedOverflowCount,
  });

  try {
    const recipientIds = resolveRecipientIds(project, agentSetting);
    const entries: Prisma.NotificationCreateManyInput[] = recipientIds.map((userId) => ({
      type: "SPRINT_OVERFLOW_WARNING",
      title,
      message,
      link,
      actorId: null,
      userId,
    }));
    await createNotifications(entries);
  } catch (err) {
    console.error("[Agent-008] Sprint taşma bildirimleri gönderilemedi:", err);
  }

  return { warned: true };
}

/**
 * Fires once a sprint transitions to COMPLETED (spec §3.2): aggregates completed/overdue/
 * scope-creep/blocker signals (reusing Agent-009's and Agent-004's pure analyzers) and
 * publishes an LLM-authored (or deterministic fallback) retrospective draft.
 */
export async function dispatchSprintRetro(
  projectId: string,
  sprintId: string,
  now: Date = getNow(),
): Promise<SprintRetroDispatchResult> {
  const project = await loadProjectForSprintAssistant(projectId);

  const agentSetting = project.agentSettings[0];
  if (agentSetting && !agentSetting.enabled) {
    return { published: false };
  }

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, projectId: true, name: true, status: true, startDate: true },
  });

  // Defensive against stale/duplicate/out-of-order event delivery.
  if (!sprint || sprint.projectId !== projectId || sprint.status !== "COMPLETED") {
    return { published: false };
  }

  const link = buildSprintDedupLink(projectId, sprintId);
  const alreadyPublished = await prisma.notification.findFirst({
    where: { type: "SPRINT_RETRO_PUBLISHED", link },
    select: { id: true },
  });
  if (alreadyPublished) {
    return { published: false };
  }

  const sprintTaskRows = await prisma.sprintTask.findMany({
    where: { sprintId },
    select: {
      taskId: true,
      addedAt: true,
      task: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          updatedAt: true,
          state: { select: { group: true } },
        },
      },
    },
  });

  const taskIds = sprintTaskRows.map((row) => row.taskId);
  const titleById = new Map(sprintTaskRows.map((row) => [row.taskId, row.task.title]));

  const relationRows =
    taskIds.length === 0
      ? []
      : await prisma.taskRelation.findMany({
          where: { type: "BLOCKS", sourceTaskId: { in: taskIds }, targetTaskId: { in: taskIds } },
          select: { sourceTaskId: true, targetTaskId: true },
        });

  const blockerRelations: BlockerRelationInput[] = relationRows.map((relation) => ({
    blockingTaskId: relation.sourceTaskId,
    blockedTaskId: relation.targetTaskId,
  }));

  const blockerTaskInputs: BlockerTaskInput[] = sprintTaskRows.map((row) => ({
    id: row.task.id,
    stateGroup: row.task.state.group,
    dueDate: row.task.dueDate,
    updatedAt: row.task.updatedAt,
  }));

  const blockerFindings = analyzeBlockerChain(blockerRelations, blockerTaskInputs, now);
  const blockerTaskIds = [...new Set(blockerFindings.map((finding) => finding.blockedTaskId))];

  const scopeCreepInput: ScopeCreepSprintTaskInput[] = sprintTaskRows.map((row) => ({
    taskId: row.taskId,
    addedAt: row.addedAt,
  }));

  const scopeCreepResult = calculateScopeCreep(
    { id: sprint.id, name: sprint.name, startDate: sprint.startDate },
    scopeCreepInput,
    now,
  );

  const completedRows = sprintTaskRows.filter((row) => row.task.state.group === "DONE");
  const overdueRows = sprintTaskRows.filter((row) => row.task.state.group !== "DONE");

  const aggregateInput: SprintRetroAggregateInput = {
    sprintName: sprint.name,
    completedCount: completedRows.length,
    overdueCount: overdueRows.length,
    scopeCreepInjectedCount: scopeCreepResult.injectedTaskCount,
    blockerFindingsCount: blockerFindings.length,
    completedTaskTitles: completedRows.map((row) => row.task.title),
    overdueTaskTitles: overdueRows.map((row) => row.task.title),
    scopeCreepTaskTitles: scopeCreepResult.injectedTaskIds
      .map((taskId) => titleById.get(taskId))
      .filter((title): title is string => Boolean(title)),
    blockerTaskTitles: blockerTaskIds
      .map((taskId) => titleById.get(taskId))
      .filter((title): title is string => Boolean(title)),
  };

  const markdown = await analyzeSprintRetro(aggregateInput);

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
  const title = `${pmName} adına Pulse Asistan: Sprint Retrospektifi Yayınlandı`;
  const message = `${pmName} adına Pulse Asistan: ${formatNotificationSnippet(markdown, 300)}`;

  try {
    const recipientIds = resolveRecipientIds(project, agentSetting);
    const entries: Prisma.NotificationCreateManyInput[] = recipientIds.map((userId) => ({
      type: "SPRINT_RETRO_PUBLISHED",
      title,
      message,
      link,
      actorId: null,
      userId,
    }));
    await createNotifications(entries);
  } catch (err) {
    console.error("[Agent-008] Sprint retro bildirimleri gönderilemedi:", err);
  }

  return { published: true };
}
