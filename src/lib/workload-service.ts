/**
 * Agent-007 (Workload Balancer) service — Phase 6 Step 6.06 (ADR-034).
 *
 * Session-independent and project-scoped: invoked by the `pulse-agent` container
 * through `POST /api/internal/agent/workload-check`. Tier C: reassignment is NEVER
 * applied automatically — this service only ever creates a PENDING `AgentProposal`
 * (`suggestedAssigneeId`) for a human PM/ADMIN to approve via `approveProposal`.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { buildNotificationDeepLink } from "@/lib/notification-logic";
import { resolvePmName } from "@/lib/deadline-tracker-logic";
import { createNotifications } from "@/actions/notification";
import { analyzeWorkloadReassignment } from "@/lib/ai/workload-interpreter";
import {
  WORKLOAD_AGENT_KEY,
  calculateTeamWorkloadSummaries,
  detectWorkloadImbalance,
  selectReassignmentCandidateTask,
  type MemberWorkloadInput,
  type ReassignmentCandidateTaskInput,
  type WorkloadReassignmentCandidateInput,
  type WorkloadTaskInput,
} from "@/lib/workload-logic";

export { WORKLOAD_AGENT_KEY };

export interface WorkloadCheckResult {
  proposalCreated: boolean;
  overloadedUserId?: string;
  underutilizedUserId?: string;
  taskId?: string;
}

const ACTIVE_STATE_GROUPS = ["TODO", "IN_PROGRESS"] as const;
const RECENT_LABEL_TASK_LIMIT = 5;
const MAX_RECENT_LABELS = 5;
const MAX_UNDERUTILIZED_CANDIDATES = 3;

/**
 * No-op for the reasons listed in the spec (disabled agent, an unresolved reassignment
 * proposal already pending, no imbalance detected, or no safe candidate task to hand off).
 */
export async function dispatchWorkloadCheck(
  projectId: string,
  now: Date = getNow(),
): Promise<WorkloadCheckResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: WORKLOAD_AGENT_KEY },
        include: { pmUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const agentSetting = project.agentSettings[0];
  if (agentSetting && !agentSetting.enabled) {
    return { proposalCreated: false };
  }

  // Avoid piling up reassignment proposals while one is unresolved.
  const existingPendingReassignment = await prisma.agentProposal.findFirst({
    where: { projectId, status: "PENDING", suggestedAssigneeId: { not: null } },
    select: { id: true },
  });
  if (existingPendingReassignment) {
    return { proposalCreated: false };
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true, user: { select: { id: true, name: true } } },
  });

  if (members.length < 2) {
    return { proposalCreated: false };
  }

  const memberIds = members.map((member) => member.userId);
  const assigneeRows = await prisma.taskAssignee.findMany({
    where: { userId: { in: memberIds }, task: { projectId } },
    select: {
      userId: true,
      task: { select: { id: true, dueDate: true, state: { select: { group: true } } } },
    },
  });

  const tasksByUser = new Map<string, WorkloadTaskInput[]>();
  for (const row of assigneeRows) {
    const list = tasksByUser.get(row.userId) ?? [];
    list.push({ id: row.task.id, stateGroup: row.task.state.group, dueDate: row.task.dueDate });
    tasksByUser.set(row.userId, list);
  }

  const memberInputs: MemberWorkloadInput[] = members.map((member) => ({
    userId: member.userId,
    userName: member.user.name,
    tasks: tasksByUser.get(member.userId) ?? [],
  }));

  const summaries = calculateTeamWorkloadSummaries(memberInputs, now);
  const { overloaded, underutilized } = detectWorkloadImbalance(summaries);

  if (overloaded.length === 0 || underutilized.length === 0) {
    return { proposalCreated: false };
  }

  const topOverloaded = overloaded[0];

  const activeTaskRows = await prisma.task.findMany({
    where: {
      projectId,
      assignees: { some: { userId: topOverloaded.userId } },
      state: { group: { in: [...ACTIVE_STATE_GROUPS] } },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      state: { select: { group: true } },
      labels: { select: { label: { select: { name: true } } } },
    },
  });

  if (activeTaskRows.length === 0) {
    return { proposalCreated: false };
  }

  const activeTaskIds = activeTaskRows.map((task) => task.id);
  const relationRows = await prisma.taskRelation.findMany({
    where: {
      OR: [{ sourceTaskId: { in: activeTaskIds } }, { targetTaskId: { in: activeTaskIds } }],
    },
    select: { sourceTaskId: true, targetTaskId: true },
  });

  const activeTaskIdSet = new Set(activeTaskIds);
  const taskIdsWithAnyRelation = new Set<string>();
  for (const relation of relationRows) {
    if (activeTaskIdSet.has(relation.sourceTaskId)) taskIdsWithAnyRelation.add(relation.sourceTaskId);
    if (activeTaskIdSet.has(relation.targetTaskId)) taskIdsWithAnyRelation.add(relation.targetTaskId);
  }

  const candidateTasksInput: ReassignmentCandidateTaskInput[] = activeTaskRows.map((task) => ({
    id: task.id,
    title: task.title,
    stateGroup: task.state.group,
    priority: task.priority,
    dueDate: task.dueDate,
  }));

  const candidateTask = selectReassignmentCandidateTask(candidateTasksInput, taskIdsWithAnyRelation);
  if (!candidateTask) {
    return { proposalCreated: false };
  }

  const candidateTaskRow = activeTaskRows.find((task) => task.id === candidateTask.id);
  const candidateTaskLabelNames = candidateTaskRow?.labels.map((l) => l.label.name) ?? [];

  const underutilizedCandidates = underutilized.slice(0, MAX_UNDERUTILIZED_CANDIDATES);
  const candidatesWithLabels: WorkloadReassignmentCandidateInput[] = [];
  for (const candidate of underutilizedCandidates) {
    const recentTasks = await prisma.task.findMany({
      where: { projectId, assignees: { some: { userId: candidate.userId } } },
      orderBy: { updatedAt: "desc" },
      take: RECENT_LABEL_TASK_LIMIT,
      select: { labels: { select: { label: { select: { name: true } } } } },
    });

    const labelNames = new Set<string>();
    for (const task of recentTasks) {
      for (const taskLabel of task.labels) {
        if (labelNames.size >= MAX_RECENT_LABELS) break;
        labelNames.add(taskLabel.label.name);
      }
      if (labelNames.size >= MAX_RECENT_LABELS) break;
    }

    candidatesWithLabels.push({
      userId: candidate.userId,
      userName: candidate.userName,
      recentLabels: [...labelNames],
    });
  }

  const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);

  const suggestion = await analyzeWorkloadReassignment({
    pmName,
    overloadedMemberName: topOverloaded.userName,
    overloadedActiveCount: topOverloaded.activeCount,
    task: { title: candidateTask.title, labels: candidateTaskLabelNames },
    candidates: candidatesWithLabels,
  });

  await prisma.$transaction(async (tx) => {
    await tx.agentProposal.create({
      data: {
        projectId,
        taskId: candidateTask.id,
        summary: suggestion.summary,
        suggestedAssigneeId: suggestion.suggestedAssigneeId,
        confidence: suggestion.confidence,
      },
    });
  });

  try {
    const adminIds = project.members.map((member) => member.userId);
    const recipientIds = new Set<string>(adminIds);
    if (agentSetting?.pmUser) {
      recipientIds.add(agentSetting.pmUser.id);
    }

    const link = buildNotificationDeepLink(projectId, candidateTask.id);
    const title = `${pmName} adına Pulse Asistan: İş Yükü Dengeleme Önerisi`;

    const entries: Prisma.NotificationCreateManyInput[] = [...recipientIds].map((userId) => ({
      type: "WORKLOAD_REBALANCE_PROPOSED",
      title,
      message: suggestion.summary,
      link,
      actorId: null,
      userId,
    }));

    await createNotifications(entries);
  } catch (err) {
    console.error("[Agent-007] İş yükü bildirimleri gönderilemedi:", err);
  }

  return {
    proposalCreated: true,
    overloadedUserId: topOverloaded.userId,
    underutilizedUserId: suggestion.suggestedAssigneeId,
    taskId: candidateTask.id,
  };
}
