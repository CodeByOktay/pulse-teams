/**
 * Agent-003 (Status Requester) service — Phase 6 Step 6.03 (ADR-034).
 *
 * Session-independent and project-scoped: invoked by the `pulse-agent` container
 * through `POST /api/internal/agent/status-requests`. Two halves per run:
 *   A. Expire PENDING ProgressRequests older than RESPONSE_TIMEOUT_DAYS (spec §3.4).
 *   B. Open new ProgressRequests for stale IN_PROGRESS tasks (spec §3.1-3.2), each one
 *      becoming a LangGraph `interrupt()` thread on the Python side.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/clock";
import { buildNotificationDeepLink } from "@/lib/notification-logic";
import { formatTaskIdentifier } from "@/lib/relation-logic";
import { resolvePmName } from "@/lib/deadline-tracker-logic";
import { createProgressRequestForUser } from "@/actions/progress";
import {
  buildNonResponseEscalationNotice,
  buildStatusRequestMessage,
  hasRequestExpired,
  isTaskStale,
  resolveStaleDays,
} from "@/lib/status-requester-logic";

export const STATUS_REQUESTER_AGENT_KEY = "agent-003";

export interface OpenedStatusRequest {
  requestId: string;
  taskId: string;
  recipientId: string;
}

export interface StatusRequestDispatchResult {
  tasksScanned: number;
  requestsOpened: number;
  requestsExpired: number;
  openedRequests: OpenedStatusRequest[];
}

export async function dispatchStatusRequests(
  projectId: string,
  now: Date = getNow(),
): Promise<StatusRequestDispatchResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, name: true } } },
      },
      agentSettings: {
        where: { agentKey: STATUS_REQUESTER_AGENT_KEY },
        include: { pmUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const adminUsers = project.members.map((member) => member.user);

  // A. Expire stale PENDING requests first (spec §3.4) — runs regardless of AgentSettings.enabled.
  let requestsExpired = 0;

  const pendingRequests = await prisma.progressRequest.findMany({
    where: { projectId, status: "PENDING" },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          sequenceId: true,
          project: { select: { identifier: true } },
        },
      },
      recipient: { select: { id: true, name: true } },
    },
  });

  for (const req of pendingRequests) {
    if (!hasRequestExpired(req.createdAt, now)) continue;

    const updated = await prisma.progressRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });

    if (updated.count !== 1) continue;

    requestsExpired++;

    const taskIdentifier = formatTaskIdentifier(req.task.project.identifier, req.task.sequenceId);
    const notice = buildNonResponseEscalationNotice({
      assigneeName: req.recipient.name,
      taskIdentifier,
      taskTitle: req.task.title,
    });

    const escalationEntries: Prisma.NotificationCreateManyInput[] = adminUsers.map((admin) => ({
      type: "PROGRESS_REQUESTED",
      title: notice.title,
      message: notice.message,
      link: buildNotificationDeepLink(projectId, req.task.id),
      userId: admin.id,
      actorId: null,
    }));

    if (escalationEntries.length > 0) {
      await prisma.notification.createMany({ data: escalationEntries });
    }
  }

  // B. Open new requests for stale IN_PROGRESS tasks (spec §3.1-3.2).
  const agentSetting = project.agentSettings[0];
  const openedRequests: OpenedStatusRequest[] = [];
  let requestsOpened = 0;
  let tasksScanned = 0;

  if (!agentSetting || agentSetting.enabled) {
    const staleDays = resolveStaleDays(agentSetting?.config);
    const pmName = resolvePmName(agentSetting?.pmUser?.name, project.owner.name);
    const requesterId = agentSetting?.pmUser?.id ?? project.owner.id;

    const candidateTasks = await prisma.task.findMany({
      where: { projectId, state: { group: "IN_PROGRESS" } },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        state: { select: { group: true } },
      },
    });

    tasksScanned = candidateTasks.length;

    for (const task of candidateTasks) {
      if (task.assignees.length === 0) continue;
      if (!isTaskStale(task.updatedAt, now, staleDays)) continue;

      const existingPending = await prisma.progressRequest.findFirst({
        where: { taskId: task.id, status: "PENDING" },
        select: { id: true },
      });
      if (existingPending) continue;

      const recipientId = task.assignees[0].user.id;
      const taskIdentifier = formatTaskIdentifier(project.identifier, task.sequenceId);
      const { title, message } = buildStatusRequestMessage({
        pmName,
        taskIdentifier,
        taskTitle: task.title,
        staleDays,
      });

      const created = await createProgressRequestForUser({
        requesterId,
        taskId: task.id,
        recipientId,
        reason: "scheduled",
        customMessage: message,
        customTitle: title,
      });

      openedRequests.push({ requestId: created.id, taskId: task.id, recipientId });
      requestsOpened++;
    }
  }

  return { tasksScanned, requestsOpened, requestsExpired, openedRequests };
}
