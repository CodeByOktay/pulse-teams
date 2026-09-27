"use server";

import { revalidatePath } from "next/cache";
import {
  getClockStatus,
  getNow,
  isTimeTravelEnabled,
  resetPersistedClock,
  syncClockFromDb,
} from "@/lib/clock";
import { applyMockClock } from "@/lib/clock-service";
import { prisma } from "@/lib/prisma";
import { requireMembership, requireSession } from "@/lib/authz";
import { dispatchDueDateReminders } from "@/lib/deadline-tracker-service";
import { dispatchTaskHygieneReport } from "@/lib/hygiene-service";
import { dispatchStatusRequests } from "@/lib/status-requester-service";

const TIME_TRAVEL_DISABLED_MESSAGE = "Zaman yolculuğu bu ortamda devre dışı.";

export interface SerializedClockStatus {
  isMocked: boolean;
  nowIso: string;
  mockTimeIso: string | null;
  timeTravelEnabled: boolean;
}

export async function getAppClockAction(): Promise<SerializedClockStatus> {
  await syncClockFromDb();
  const status = getClockStatus();
  return {
    isMocked: status.isMocked,
    nowIso: status.now.toISOString(),
    mockTimeIso: status.mockTime ? status.mockTime.toISOString() : null,
    timeTravelEnabled: isTimeTravelEnabled(),
  };
}

export async function setAppClockAction(isoDateString: string): Promise<SerializedClockStatus> {
  const session = await requireSession();
  if (!isTimeTravelEnabled()) {
    throw new Error(TIME_TRAVEL_DISABLED_MESSAGE);
  }

  const targetDate = new Date(isoDateString);
  if (isNaN(targetDate.getTime())) {
    throw new Error("Geçersiz tarih formatı.");
  }

  await applyMockClock(targetDate, session.user.id);
  revalidatePath("/", "layout");

  const status = getClockStatus();
  return {
    isMocked: status.isMocked,
    nowIso: status.now.toISOString(),
    mockTimeIso: status.mockTime ? status.mockTime.toISOString() : null,
    timeTravelEnabled: true,
  };
}

export async function resetAppClockAction(): Promise<SerializedClockStatus> {
  await requireSession();
  if (!isTimeTravelEnabled()) {
    throw new Error(TIME_TRAVEL_DISABLED_MESSAGE);
  }

  await resetPersistedClock();
  revalidatePath("/", "layout");

  const status = getClockStatus();
  return {
    isMocked: status.isMocked,
    nowIso: status.now.toISOString(),
    mockTimeIso: null,
    timeTravelEnabled: true,
  };
}

export interface AgentSimulationResult {
  executedAt: string;
  deadlineResult: { tasksScanned: number; remindersSent: number; escalationsSent: number };
  hygieneResult: { tasksScanned: number; defectiveTasks: number; reportSent: boolean };
  statusResult: { tasksScanned: number; requestsOpened: number; requestsExpired: number };
}

/**
 * Runs active AI agents against current effective clock (simulated or real).
 * Ideal for manual verification of deadline, hygiene, and status automation workflows.
 */
export async function triggerSimulatedAgentsAction(
  targetProjectId?: string,
): Promise<AgentSimulationResult> {
  const session = await requireSession();
  if (!isTimeTravelEnabled()) {
    throw new Error(TIME_TRAVEL_DISABLED_MESSAGE);
  }
  const userId = session.user.id;

  let projects: { id: string }[];
  if (targetProjectId) {
    await requireMembership(targetProjectId, userId);
    projects = [{ id: targetProjectId }];
  } else {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    projects = memberships.map((membership) => ({ id: membership.projectId }));
  }

  const effectiveNow = getNow();

  const totalDeadline = { tasksScanned: 0, remindersSent: 0, escalationsSent: 0 };
  const totalHygiene = { tasksScanned: 0, defectiveTasks: 0, reportSent: false };
  const totalStatus = { tasksScanned: 0, requestsOpened: 0, requestsExpired: 0 };

  for (const prj of projects) {
    try {
      const dRes = await dispatchDueDateReminders(prj.id, effectiveNow);
      totalDeadline.tasksScanned += dRes.tasksScanned;
      totalDeadline.remindersSent += dRes.remindersSent;
      totalDeadline.escalationsSent += dRes.escalationsSent;
    } catch (e) {
      console.warn(`[Simulated Agent Run] deadline-check error for ${prj.id}:`, e);
    }

    try {
      const hRes = await dispatchTaskHygieneReport(prj.id, effectiveNow);
      totalHygiene.tasksScanned += hRes.tasksScanned;
      totalHygiene.defectiveTasks += hRes.defectiveTasks;
      if (hRes.reportSent) totalHygiene.reportSent = true;
    } catch (e) {
      console.warn(`[Simulated Agent Run] hygiene-check error for ${prj.id}:`, e);
    }

    try {
      const sRes = await dispatchStatusRequests(prj.id, effectiveNow);
      totalStatus.tasksScanned += sRes.tasksScanned;
      totalStatus.requestsOpened += sRes.requestsOpened;
      totalStatus.requestsExpired += sRes.requestsExpired;
    } catch (e) {
      console.warn(`[Simulated Agent Run] status-request error for ${prj.id}:`, e);
    }
  }

  revalidatePath("/", "layout");

  return {
    executedAt: effectiveNow.toISOString(),
    deadlineResult: totalDeadline,
    hygieneResult: totalHygiene,
    statusResult: totalStatus,
  };
}
