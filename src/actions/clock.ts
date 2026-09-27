"use server";

import { revalidatePath } from "next/cache";
import {
  getClockStatus,
  getNow,
  persistMockClock,
  resetPersistedClock,
  syncClockFromDb,
} from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { dispatchDueDateReminders } from "@/lib/deadline-tracker-service";
import { dispatchTaskHygieneReport } from "@/lib/hygiene-service";
import { dispatchStatusRequests } from "@/lib/status-requester-service";

export interface SerializedClockStatus {
  isMocked: boolean;
  nowIso: string;
  mockTimeIso: string | null;
}

export async function getAppClockAction(): Promise<SerializedClockStatus> {
  await syncClockFromDb();
  const status = getClockStatus();
  return {
    isMocked: status.isMocked,
    nowIso: status.now.toISOString(),
    mockTimeIso: status.mockTime ? status.mockTime.toISOString() : null,
  };
}

export async function setAppClockAction(isoDateString: string): Promise<SerializedClockStatus> {
  const targetDate = new Date(isoDateString);
  if (isNaN(targetDate.getTime())) {
    throw new Error("Geçersiz tarih formatı.");
  }

  await persistMockClock(targetDate);
  revalidatePath("/", "layout");

  const status = getClockStatus();
  return {
    isMocked: status.isMocked,
    nowIso: status.now.toISOString(),
    mockTimeIso: status.mockTime ? status.mockTime.toISOString() : null,
  };
}

export async function resetAppClockAction(): Promise<SerializedClockStatus> {
  await resetPersistedClock();
  revalidatePath("/", "layout");

  const status = getClockStatus();
  return {
    isMocked: status.isMocked,
    nowIso: status.now.toISOString(),
    mockTimeIso: null,
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
  const effectiveNow = getNow();

  const projects = targetProjectId
    ? [{ id: targetProjectId }]
    : await prisma.project.findMany({ select: { id: true } });

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
