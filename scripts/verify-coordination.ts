/**
 * Pulse Step 6.08 (v0.6.7) — Multi-agent coordination verification harness.
 * ADR-036 decision B7: an approved DEVELOPER TOOL, not a test suite.
 *
 *   - Do NOT run this under Vitest / Pytest.
 *   - Do NOT move it under src/lib/__tests__/ or agent/tests/.
 *   - It is never invoked by `npm test` or `pytest`.
 *
 * Exercises the three cross-agent chains described in
 * docs/spec/v0.6.7-step-6.08.md §2 (Scenarios A/B/C) against the REAL local
 * PostgreSQL database (the same one `npm run dev` / `pulse-postgres` uses) by
 * calling the session-independent Next.js agent services directly with
 * explicit `now` values (a simulated timeline), then prints a PASS/FAIL
 * report per step and deletes every row it created.
 *
 * Run:
 *   npm run verify:coordination
 */

// ---------------------------------------------------------------------------
// 0. Runtime shims — MUST execute before any `@/actions/*` / `@/lib/*` import
//    below (see the "Running" section of the task for why).
// ---------------------------------------------------------------------------
//
// `src/actions/progress.ts` (used by Agent-003's `dispatchStatusRequests` via
// `createProgressRequestForUser`) unconditionally calls `revalidatePath()`
// from `next/cache` on its happy path. Outside a real Next.js request/build
// context, `next/cache` throws at CALL time (not at import time): "Invariant:
// static generation store missing in revalidatePath". We are not allowed to
// edit the service, so we stub the module at Node's loader level instead —
// this patches the public `node:module` `Module._load` hook. No `require()`
// call appears anywhere in this file, so `@typescript-eslint/no-require-imports`
// stays satisfied without any eslint-disable comment.
import Module from "node:module";
import path from "node:path";

type LegacyModuleLoader = (
  this: unknown,
  request: string,
  parent: NodeModule | null | undefined,
  isMain: boolean,
) => unknown;

interface ModuleWithLegacyLoad {
  _load: LegacyModuleLoader;
}

function stubNextCache(): void {
  const moduleWithLoad = Module as unknown as ModuleWithLegacyLoad;
  const originalLoad = moduleWithLoad._load;

  moduleWithLoad._load = function patchedLoad(request, parent, isMain) {
    if (request === "next/cache") {
      return {
        revalidatePath: () => {},
        revalidateTag: () => {},
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}

stubNextCache();

// `ai.config.json` at the repo root points at a real external LLM endpoint,
// and AI_API_KEY is set in `.env`. Point `AI_CONFIG_PATH` at a file that does
// not exist so `resolveLlmConfig()` (src/lib/ai/llm-config.ts) sees no
// endpoint/model and `getLlmProvider()` returns null — every agent then takes
// its deterministic heuristic fallback path. Zero network calls, zero cost,
// fully offline/CI-safe. Read lazily by `loadLlmConfig()` on every call, so
// setting it here (before we ever invoke a dispatch* function) is sufficient.
process.env.AI_CONFIG_PATH = path.join(__dirname, "__verify-coordination-no-ai-config__.json");

// ---------------------------------------------------------------------------
// 1. Imports (safe now that the shims above are installed)
// ---------------------------------------------------------------------------
import { randomBytes } from "node:crypto";
import type { ActivityType, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { dispatchDueDateReminders } from "@/lib/deadline-tracker-service";
import { dispatchBlockerCheck } from "@/lib/blocker-service";
import { openTodayStandup, submitStandupEntry, synthesizeStandup } from "@/lib/standup-service";
import { dispatchStatusRequests } from "@/lib/status-requester-service";
import { dispatchScopeCreepCheck } from "@/lib/scope-creep-service";
import { dispatchWorkloadCheck } from "@/lib/workload-service";
import { dispatchSprintOverflowCheck, dispatchSprintRetro } from "@/lib/sprint-assistant-service";
import { dispatchWeeklyDigest } from "@/lib/weekly-digest-service";
import { triggerUnblockedDependencies } from "@/lib/dependency-automation";

// ---------------------------------------------------------------------------
// 2. Report harness
// ---------------------------------------------------------------------------
interface StepResult {
  scenario: string;
  step: string;
  pass: boolean;
  detail: string;
}

const results: StepResult[] = [];
const notes: string[] = [];

function record(scenario: string, step: string, pass: boolean, detail: string): boolean {
  results.push({ scenario, step, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${scenario} :: ${step} — ${detail}`);
  return pass;
}

function note(message: string): void {
  notes.push(message);
  console.log(`[NOTE] ${message}`);
}

// ---------------------------------------------------------------------------
// 3. Time helpers
// ---------------------------------------------------------------------------
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Europe/Istanbul has observed a fixed UTC+3 offset (no DST) since 2016 — the
 * same convention `standup-logic.ts` / `weekly-digest-logic.ts` rely on — so
 * building an Istanbul wall-clock instant as `UTC(hour - 3)` is safe here.
 */
function ist(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// 4. DB assertion helpers
// ---------------------------------------------------------------------------
//
// IMPORTANT: Notification.createdAt and Activity.createdAt are `@default(now())`
// columns — PostgreSQL's REAL server clock, completely independent of the
// simulated `now` we pass into dispatch*() calls (that `now` only drives the
// *business logic* thresholds inside each service). So "did this call create a
// new row" is checked against a real-wall-clock marker captured immediately
// before the call, NOT against the simulated day boundaries the services use
// internally for their own "already sent today" dedup checks.
function marker(): Date {
  return new Date();
}

async function countNotificationsSince(
  userId: string,
  type: NotificationType,
  since: Date,
): Promise<number> {
  return prisma.notification.count({ where: { userId, type, createdAt: { gte: since } } });
}

async function countActivitiesSince(taskId: string, type: ActivityType, since: Date): Promise<number> {
  return prisma.activity.count({ where: { taskId, type, createdAt: { gte: since } } });
}

// ---------------------------------------------------------------------------
// 5. Sandbox setup
// ---------------------------------------------------------------------------
const runId = randomBytes(4).toString("hex");

function sandboxEmail(role: string): string {
  return `verify+${runId}-${role}@pulse.local`;
}

const createdUserIds: string[] = [];
let createdProjectId: string | null = null;

interface SandboxUser {
  id: string;
  name: string;
}

async function createSandboxUser(role: string, name: string): Promise<SandboxUser> {
  const user = await prisma.user.create({
    data: {
      name,
      email: sandboxEmail(role),
      hashedPassword: "verify-coordination-sandbox-not-a-real-account",
    },
    select: { id: true, name: true },
  });
  createdUserIds.push(user.id);
  return user;
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "P2002";
}

async function createSandboxProject(ownerId: string): Promise<{ id: string; identifier: string }> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const suffix = randomBytes(1).toString("hex").toUpperCase(); // 2 hex chars
    const identifier = `VRF${suffix}`; // Project.identifier is @db.VarChar(5) -> exactly 5 chars
    try {
      const project = await prisma.project.create({
        data: { name: `Verify Coordination ${runId}`, identifier, ownerId },
        select: { id: true, identifier: true },
      });
      createdProjectId = project.id;
      return project;
    } catch (err) {
      if (isUniqueConstraintError(err) && attempt < maxAttempts) continue;
      throw err;
    }
  }
  throw new Error("Could not allocate a unique sandbox project identifier");
}

interface Sandbox {
  projectId: string;
  identifier: string;
  owner: SandboxUser;
  userA: SandboxUser;
  userB: SandboxUser;
  userOverload: SandboxUser;
  userIdle: SandboxUser;
  states: { todo: string; inProgress: string; done: string };
}

let taskSequence = 0;
function nextSequenceId(): number {
  taskSequence += 1;
  return taskSequence;
}

async function setupSandbox(): Promise<Sandbox> {
  const owner = await createSandboxUser("owner", "Verify Owner");
  const userA = await createSandboxUser("usera", "Verify User A");
  const userB = await createSandboxUser("userb", "Verify User B");
  const userOverload = await createSandboxUser("overload", "Verify Overload");
  const userIdle = await createSandboxUser("idle", "Verify Idle");

  const project = await createSandboxProject(owner.id);

  // Mirrors createProject (src/actions/project.ts): owner gets an explicit ADMIN
  // ProjectMember row (agent services select recipients via `members.where(role: "ADMIN")`).
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: owner.id, role: "ADMIN" },
      { projectId: project.id, userId: userA.id, role: "MEMBER" },
      { projectId: project.id, userId: userB.id, role: "MEMBER" },
      { projectId: project.id, userId: userOverload.id, role: "MEMBER" },
      { projectId: project.id, userId: userIdle.id, role: "MEMBER" },
    ],
  });

  const [todo, inProgress, done] = await Promise.all([
    prisma.state.create({
      data: { name: "To Do", group: "TODO", sequence: 1000, isDefault: true, projectId: project.id },
    }),
    prisma.state.create({
      data: { name: "In Progress", group: "IN_PROGRESS", sequence: 2000, projectId: project.id },
    }),
    prisma.state.create({
      data: { name: "Done", group: "DONE", sequence: 3000, projectId: project.id },
    }),
  ]);

  return {
    projectId: project.id,
    identifier: project.identifier,
    owner,
    userA,
    userB,
    userOverload,
    userIdle,
    states: { todo: todo.id, inProgress: inProgress.id, done: done.id },
  };
}

async function createTask(params: {
  projectId: string;
  title: string;
  stateId: string;
  assigneeId?: string;
  dueDate?: Date | null;
}): Promise<{ id: string; title: string }> {
  const task = await prisma.task.create({
    data: {
      projectId: params.projectId,
      title: params.title,
      stateId: params.stateId,
      sequenceId: nextSequenceId(),
      dueDate: params.dueDate ?? null,
    },
    select: { id: true, title: true },
  });
  if (params.assigneeId) {
    await prisma.taskAssignee.create({ data: { taskId: task.id, userId: params.assigneeId } });
  }
  return task;
}

async function backdateTaskUpdatedAt(taskId: string, updatedAt: Date): Promise<void> {
  // Prisma honors an explicit value for an `@updatedAt` field on `.update()`
  // (verified against the live DB before writing this harness) — it only
  // auto-computes `now()` when the field is omitted from `data`.
  await prisma.task.update({ where: { id: taskId }, data: { updatedAt } });
}

/**
 * Mirrors the minimal DB writes `updateTask` (src/actions/task.ts) performs for
 * a state change: update `Task.stateId` + write a `TASK_STATE_CHANGED` Activity
 * inside one transaction. We cannot call the actual server action here — it
 * requires a NextAuth session via `requireUserId()`. Deliberately does NOT call
 * `emitDomainEvent` (unlike the real action) so this harness never enqueues a
 * `DomainEvent` the live `pulse-agent` container could pick up — see the NOTE
 * printed by `main()` for why that's safe for every agent under test here.
 */
async function transitionTaskState(params: {
  taskId: string;
  newStateId: string;
  oldStateName: string;
  newStateName: string;
  actorId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: params.taskId }, data: { stateId: params.newStateId } });
    await logActivity(tx, {
      type: "TASK_STATE_CHANGED",
      taskId: params.taskId,
      actorId: params.actorId,
      oldValue: params.oldStateName,
      newValue: params.newStateName,
    });
  });
}

// ---------------------------------------------------------------------------
// 6. Scenario A — Blocker & Status Coordination Chain (spec §2 Senaryo A)
// ---------------------------------------------------------------------------
async function runScenarioA(sb: Sandbox): Promise<void> {
  const SCENARIO = "A (Blocker & Status Chain)";
  const SA_now = ist(2026, 1, 5, 9, 0); // Mon Jan 5, 2026, 09:00 Europe/Istanbul

  const taskA = await createTask({
    projectId: sb.projectId,
    title: "Blocker Chain Task A",
    stateId: sb.states.inProgress,
    assigneeId: sb.userA.id,
    dueDate: addDays(SA_now, 1), // due tomorrow -> Agent-001 "1 day left" reminder
  });
  // Backdated 3 days so Agent-003 (stale >= 3d) and Agent-004 (stale > 2d) both trigger.
  await backdateTaskUpdatedAt(taskA.id, addDays(SA_now, -3));

  const taskB = await createTask({
    projectId: sb.projectId,
    title: "Blocked Task B",
    stateId: sb.states.todo,
    assigneeId: sb.userB.id,
  });

  await prisma.taskRelation.create({
    data: { sourceTaskId: taskA.id, targetTaskId: taskB.id, type: "BLOCKS" },
  });

  // --- Agent-001 (Deadline Tracker) ---------------------------------------
  let since = marker();
  const deadline1 = await dispatchDueDateReminders(sb.projectId, SA_now);
  const deadlineNotifs1 = await countNotificationsSince(sb.userA.id, "DUE_DATE_APPROACHING", since);
  record(
    SCENARIO,
    "Agent-001 sends a due-date reminder to A's assignee",
    deadline1.remindersSent >= 1 && deadlineNotifs1 >= 1,
    `remindersSent=${deadline1.remindersSent}, notificationsObserved=${deadlineNotifs1}`,
  );

  const deadline2 = await dispatchDueDateReminders(sb.projectId, SA_now);
  record(
    SCENARIO,
    "Agent-001 idempotency: same `now` twice sends 0 new reminders",
    deadline2.remindersSent === 0,
    `remindersSent(2nd call)=${deadline2.remindersSent}`,
  );

  // --- Agent-004 (Blocker Manager) stale-blocker warning ------------------
  since = marker();
  const blocker1 = await dispatchBlockerCheck(sb.projectId, SA_now);
  const staleNotifs1 = await countNotificationsSince(sb.owner.id, "DUE_DATE_APPROACHING", since);
  record(
    SCENARIO,
    "Agent-004 raises a [Darboğaz Uyarısı] stale-blocker finding for A -> B",
    blocker1.staleFindings >= 1 && blocker1.notificationsSent >= 1 && staleNotifs1 >= 1,
    `staleFindings=${blocker1.staleFindings}, notificationsSent=${blocker1.notificationsSent}`,
  );

  const blocker2 = await dispatchBlockerCheck(sb.projectId, SA_now);
  record(
    SCENARIO,
    "Agent-004 idempotency: same `now` twice sends 0 new stale-blocker notifications",
    blocker2.notificationsSent === 0,
    `notificationsSent(2nd call)=${blocker2.notificationsSent}`,
  );

  // --- Agent-005 (Standup) blocker red flag -------------------------------
  const standupNow = ist(2026, 1, 5, 10, 0); // 10:00 IST, inside the 09:30-11:30 window
  await openTodayStandup(sb.projectId, standupNow);
  await submitStandupEntry(
    {
      projectId: sb.projectId,
      userId: sb.userA.id,
      yesterday: "Blocker zincirinin çözülmesini bekledim.",
      today: "Task A üzerinde çalışıyorum ama engellendim.",
      blockers: "Task A, bağımlı olduğum bir üst görev tarafından engelleniyor.",
    },
    standupNow,
  );
  const synthesizeNow = ist(2026, 1, 5, 11, 35); // after the 11:30 cutoff, same calendar day
  const standupResult = await synthesizeStandup(sb.projectId, synthesizeNow);
  const standupRow = await prisma.dailyStandup.findFirst({
    where: { projectId: sb.projectId },
    orderBy: { createdAt: "desc" },
  });
  const summaryHasWarning = Boolean(standupRow?.summary?.includes("⚠️"));
  record(
    SCENARIO,
    "Agent-005 publishes a standup summary flagging the blocker with a ⚠️ section",
    standupResult.published && summaryHasWarning,
    `published=${standupResult.published}, summaryHasWarning=${summaryHasWarning}`,
  );

  // --- Agent-003 (Status Requester) opens a status request ----------------
  const statusResult = await dispatchStatusRequests(sb.projectId, SA_now);
  const openedForA = statusResult.openedRequests.find((r) => r.taskId === taskA.id);
  record(
    SCENARIO,
    "Agent-003 opens a status request for stale in-progress Task A",
    Boolean(openedForA) && openedForA?.recipientId === sb.userA.id,
    `requestsOpened=${statusResult.requestsOpened}, openedForA=${Boolean(openedForA)}`,
  );

  // --- Task A resolved -> DONE -> Agent-004's unblock chain fires ---------
  since = marker();
  await transitionTaskState({
    taskId: taskA.id,
    newStateId: sb.states.done,
    oldStateName: "In Progress",
    newStateName: "Done",
    actorId: sb.userA.id,
  });
  await triggerUnblockedDependencies(taskA.id, taskA.title, sb.projectId, sb.userA.id);

  const unblockActivities1 = await countActivitiesSince(taskB.id, "TASK_UNBLOCKED", since);
  const unblockNotifs1 = await countNotificationsSince(sb.userB.id, "TASK_UNBLOCKED", since);
  record(
    SCENARIO,
    "triggerUnblockedDependencies sends exactly 1 TASK_UNBLOCKED notification to B's assignee",
    unblockActivities1 === 1 && unblockNotifs1 === 1,
    `activities=${unblockActivities1}, notifications=${unblockNotifs1}`,
  );

  // --- Agent-004 safety-net sweep must NOT duplicate it -------------------
  const safetyNet = await dispatchBlockerCheck(sb.projectId, SA_now);
  const unblockActivitiesAfterSweep = await countActivitiesSince(taskB.id, "TASK_UNBLOCKED", since);
  record(
    SCENARIO,
    "Agent-004 safety-net sweep does not send a duplicate TASK_UNBLOCKED",
    safetyNet.unblockedVerified === 0 && unblockActivitiesAfterSweep === 1,
    `unblockedVerified=${safetyNet.unblockedVerified}, totalActivitiesSoFar=${unblockActivitiesAfterSweep}`,
  );

  // --- Extra: reopen A (DONE -> IN_PROGRESS -> DONE) allows exactly 1 more ---
  await transitionTaskState({
    taskId: taskA.id,
    newStateId: sb.states.inProgress,
    oldStateName: "Done",
    newStateName: "In Progress",
    actorId: sb.userA.id,
  });
  await transitionTaskState({
    taskId: taskA.id,
    newStateId: sb.states.done,
    oldStateName: "In Progress",
    newStateName: "Done",
    actorId: sb.userA.id,
  });
  await triggerUnblockedDependencies(taskA.id, taskA.title, sb.projectId, sb.userA.id);

  const unblockActivities2 = await countActivitiesSince(taskB.id, "TASK_UNBLOCKED", since);
  const unblockNotifs2 = await countNotificationsSince(sb.userB.id, "TASK_UNBLOCKED", since);
  record(
    SCENARIO,
    "Reopening + re-completing A allows exactly 1 additional TASK_UNBLOCKED (total 2)",
    unblockActivities2 === 2 && unblockNotifs2 === 2,
    `totalActivities=${unblockActivities2}, totalNotifications=${unblockNotifs2}`,
  );
}

// ---------------------------------------------------------------------------
// 7. Shared sprint arc for Scenarios B + C (spec §2 Senaryo B/C describe two
//    halves of the same sprint's lifecycle — mid-sprint scope/workload signals,
//    then end-of-sprint overflow/digest/completion/retro).
// ---------------------------------------------------------------------------
interface SprintContext {
  sprintId: string;
  startDate: Date;
  endDate: Date;
}

async function setupSprintArc(sb: Sandbox): Promise<SprintContext> {
  const startDate = ist(2026, 1, 5, 9, 0); // Mon Jan 5
  const endDate = ist(2026, 1, 21, 18, 0); // Wed Jan 21

  const sprint = await prisma.sprint.create({
    data: { projectId: sb.projectId, name: "Verify Sprint", status: "ACTIVE", startDate, endDate },
    select: { id: true },
  });

  const baselineSpecs: { title: string; stateId: string; completedAt?: Date }[] = [
    { title: "Baseline Done 1", stateId: sb.states.done, completedAt: ist(2026, 1, 6, 12, 0) },
    { title: "Baseline Done 2", stateId: sb.states.done, completedAt: ist(2026, 1, 8, 12, 0) },
    { title: "Baseline Todo", stateId: sb.states.todo },
    { title: "Baseline In Progress 1", stateId: sb.states.inProgress },
    { title: "Baseline In Progress 2", stateId: sb.states.inProgress },
  ];
  for (const spec of baselineSpecs) {
    const task = await createTask({ projectId: sb.projectId, title: spec.title, stateId: spec.stateId });
    // `updatedAt` doubles as the "completedAt" proxy for DONE tasks in the weekly-digest
    // and sprint-assistant services (same convention documented in their pure logic).
    if (spec.completedAt) await backdateTaskUpdatedAt(task.id, spec.completedAt);
    await prisma.sprintTask.create({ data: { sprintId: sprint.id, taskId: task.id, addedAt: startDate } });
  }

  // 3 tasks injected after sprint start -> Agent-009 scope-creep trigger
  // (injectedTaskCount >= 3 OR growthRatePercent >= 15; here both hold: 3/5 = 60%).
  const injectedAddedAt = ist(2026, 1, 8, 10, 0);
  for (const title of ["Injected 1", "Injected 2", "Injected 3"]) {
    const task = await createTask({ projectId: sb.projectId, title, stateId: sb.states.todo });
    await prisma.sprintTask.create({ data: { sprintId: sprint.id, taskId: task.id, addedAt: injectedAddedAt } });
  }

  return { sprintId: sprint.id, startDate, endDate };
}

// ---------------------------------------------------------------------------
// 8. Scenario B — Resource Balancing & Scope Management (spec §2 Senaryo B)
// ---------------------------------------------------------------------------
async function runScenarioB(sb: Sandbox): Promise<void> {
  const SCENARIO = "B (Scope Creep & Workload)";

  // --- Agent-009 (Scope Creep Detection) ----------------------------------
  const scopeCreepNow = ist(2026, 1, 9, 9, 0);
  const scopeCreep1 = await dispatchScopeCreepCheck(sb.projectId, scopeCreepNow);
  record(
    SCENARIO,
    "Agent-009 detects >=3 injected tasks mid-sprint and warns admins",
    scopeCreep1.sprintChecked &&
      scopeCreep1.injectedTaskCount === 3 &&
      scopeCreep1.thresholdExceeded &&
      scopeCreep1.notificationSent,
    `injectedTaskCount=${scopeCreep1.injectedTaskCount}, growthRatePercent=${scopeCreep1.growthRatePercent.toFixed(1)}, notificationSent=${scopeCreep1.notificationSent}`,
  );

  const scopeCreep2 = await dispatchScopeCreepCheck(sb.projectId, scopeCreepNow);
  record(
    SCENARIO,
    "Agent-009 idempotency: same `now` twice sends 0 new scope-creep notifications",
    scopeCreep2.notificationSent === false,
    `notificationSent(2nd call)=${scopeCreep2.notificationSent}`,
  );

  // --- Agent-007 (Workload Balancer) --------------------------------------
  // 5 active tasks for userOverload (>= DEFAULT_OVERLOAD_ACTIVE_TASK_THRESHOLD) vs
  // 0 for userIdle -> a clear overloaded/underutilized pair. Deliberately NOT part
  // of the sprint above, so it can't perturb the scope-creep counts.
  const overloadSpecs = [
    { title: "Overload TODO 1", stateId: sb.states.todo },
    { title: "Overload TODO 2", stateId: sb.states.todo },
    { title: "Overload IP 1", stateId: sb.states.inProgress },
    { title: "Overload IP 2", stateId: sb.states.inProgress },
    { title: "Overload IP 3", stateId: sb.states.inProgress },
  ];
  for (const spec of overloadSpecs) {
    await createTask({
      projectId: sb.projectId,
      title: spec.title,
      stateId: spec.stateId,
      assigneeId: sb.userOverload.id,
    });
  }

  const workloadNow = ist(2026, 1, 9, 11, 0);
  const workload1 = await dispatchWorkloadCheck(sb.projectId, workloadNow);
  record(
    SCENARIO,
    "Agent-007 creates a PENDING reassignment AgentProposal (never auto-applies)",
    workload1.proposalCreated && workload1.overloadedUserId === sb.userOverload.id && Boolean(workload1.taskId),
    `proposalCreated=${workload1.proposalCreated}, overloadedUserId=${workload1.overloadedUserId}, taskId=${workload1.taskId}`,
  );

  const proposal = workload1.taskId
    ? await prisma.agentProposal.findFirst({
        where: { projectId: sb.projectId, taskId: workload1.taskId },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const stillAssignedToOverload = workload1.taskId
    ? await prisma.taskAssignee.findUnique({
        where: { taskId_userId: { taskId: workload1.taskId, userId: sb.userOverload.id } },
      })
    : null;
  record(
    SCENARIO,
    "Reassignment proposal is PENDING and the human gate held: assignee unchanged",
    proposal?.status === "PENDING" && Boolean(stillAssignedToOverload),
    `proposalStatus=${proposal?.status}, assigneeStillOverload=${Boolean(stillAssignedToOverload)}`,
  );

  const workload2 = await dispatchWorkloadCheck(sb.projectId, workloadNow);
  record(
    SCENARIO,
    "Agent-007 idempotency: a pending reassignment blocks piling up a duplicate proposal",
    workload2.proposalCreated === false,
    `proposalCreated(2nd call)=${workload2.proposalCreated}`,
  );
}

// ---------------------------------------------------------------------------
// 9. Scenario C — Sprint Close & Reporting Symphony (spec §2 Senaryo C)
// ---------------------------------------------------------------------------
async function runScenarioC(sb: Sandbox, sprint: SprintContext): Promise<void> {
  const SCENARIO = "C (Sprint Close & Reporting)";

  // --- Agent-008 overflow warning, exactly 2 calendar days before end -----
  const overflowNow = ist(2026, 1, 19, 10, 0); // Jan 21 - Jan 19 = 2 days
  const overflow1 = await dispatchSprintOverflowCheck(sb.projectId, overflowNow);
  record(
    SCENARIO,
    "Agent-008 raises a sprint overflow warning 2 days before end",
    overflow1.warned,
    `warned=${overflow1.warned}`,
  );

  const overflow2 = await dispatchSprintOverflowCheck(sb.projectId, overflowNow);
  record(
    SCENARIO,
    "Agent-008 idempotency: same `now` twice sends 0 duplicate overflow warnings",
    overflow2.warned === false,
    `warned(2nd call)=${overflow2.warned}`,
  );

  // --- Agent-006 weekly digest, Friday 17:00 -------------------------------
  const digestNow = ist(2026, 1, 9, 17, 0); // Friday 17:00 IST, sprint still ACTIVE
  const digest1 = await dispatchWeeklyDigest(sb.projectId, digestNow);
  record(
    SCENARIO,
    "Agent-006 publishes the Friday 17:00 weekly sprint digest",
    digest1.sent,
    `sent=${digest1.sent}, healthStatus=${digest1.healthStatus}`,
  );

  const digest2 = await dispatchWeeklyDigest(sb.projectId, digestNow);
  record(
    SCENARIO,
    "Agent-006 idempotency: same `now` twice sends 0 duplicate digests",
    digest2.sent === false,
    `sent(2nd call)=${digest2.sent}`,
  );

  // --- Sprint completes -> Agent-008 publishes the retro draft ------------
  await prisma.sprint.update({ where: { id: sprint.sprintId }, data: { status: "COMPLETED" } });
  const retroNow = ist(2026, 1, 21, 19, 0);
  const retro1 = await dispatchSprintRetro(sb.projectId, sprint.sprintId, retroNow);
  record(
    SCENARIO,
    "Agent-008 publishes a retro draft once the sprint is COMPLETED",
    retro1.published,
    `published=${retro1.published}`,
  );

  const retro2 = await dispatchSprintRetro(sb.projectId, sprint.sprintId, retroNow);
  record(
    SCENARIO,
    "Agent-008 idempotency: same `now` twice sends 0 duplicate retros",
    retro2.published === false,
    `published(2nd call)=${retro2.published}`,
  );
}

// ---------------------------------------------------------------------------
// 10. Cleanup & report
// ---------------------------------------------------------------------------
async function cleanupSandbox(): Promise<void> {
  // Project delete cascades: ProjectMember, State, Task (+TaskLabel/TaskAssignee/
  // Comment/SprintTask/Activity/TaskRelation/ProgressRequest/AgentProposal/
  // TaskEmbedding), Label, Sprint(+SprintTask), ProjectInvite, DailyStandup(+StandupEntry).
  // Notification has no FK to Project/Task (only userId/actorId -> User), so it survives
  // the project delete and is cleaned up below via the User cascade instead.
  try {
    if (createdProjectId) {
      await prisma.project.delete({ where: { id: createdProjectId } });
    }
  } catch (err) {
    console.error("[cleanup] Failed to delete sandbox project:", err);
  }

  try {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  } catch (err) {
    console.error("[cleanup] Failed to delete sandbox users:", err);
  }
}

function printSummary(): void {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;

  console.log(`\n${"=".repeat(72)}`);
  console.log(`Step 6.08 coordination verification — ${passed}/${total} checks passed`);
  if (failed > 0) {
    console.log(`${failed} FAILED check(s):`);
    for (const r of results.filter((res) => !res.pass)) {
      console.log(`  - ${r.scenario} :: ${r.step} — ${r.detail}`);
    }
  }
  if (notes.length > 0) {
    console.log("\nNotes:");
    for (const n of notes) console.log(`  - ${n}`);
  }
  console.log("=".repeat(72));
}

// ---------------------------------------------------------------------------
// 11. Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`Sandbox run id: ${runId}`);

  note(
    "Assertions use real-wall-clock markers (captured immediately before each dispatch " +
      "call) to detect newly-created rows, instead of the simulated `now` values passed " +
      "into the services — Notification.createdAt/Activity.createdAt are `@default(now())` " +
      "(PostgreSQL's real clock), independent of the app-level simulated clock.",
  );
  note(
    "No AgentSettings rows are created for the sandbox project. The Python supervisor's " +
      "own project-selection query (agent/src/supervisor.py, run_all_due) only considers " +
      "projects that HAVE an AgentSettings row ('agents are opt-in per project'), so the " +
      "live pulse-agent container never picks up this sandbox project.",
  );
  note(
    "No DomainEvent rows are emitted by this script: none of the 10 services under test " +
      "import src/lib/domain-events.ts, and Task state transitions are replicated with a " +
      "direct Task.update + logActivity write (skipping emitDomainEvent) instead of calling " +
      "src/actions/task.ts, so the live pulse-agent container's outbox poller sees nothing " +
      "from this run.",
  );

  const sb = await setupSandbox();
  console.log(`Sandbox project: ${sb.identifier} (${sb.projectId})`);

  try {
    await runScenarioA(sb);
    const sprint = await setupSprintArc(sb);
    await runScenarioB(sb);
    await runScenarioC(sb, sprint);
  } finally {
    await cleanupSandbox();
  }

  printSummary();

  process.exitCode = results.some((r) => !r.pass) ? 1 : 0;
}

main()
  .catch((err: unknown) => {
    console.error("[FATAL]", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
