import { PrismaClient, type Priority, type ActivityType, type SprintStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  createSeededRng,
  SEED_USERS,
  SEED_PROJECTS,
  SEED_STATE_TEMPLATES,
  SEED_LABEL_TEMPLATES,
  LABEL_COLOR_PALETTE,
  TASK_TYPE_WEIGHTS,
  generateTaskTitle,
  generateTaskDescription,
  generateCommentContent,
  PRIORITY_WEIGHTS,
  SEED_RANGE_START,
  SEED_RANGE_END,
  randomDateBetween,
  buildSprintWindows,
  type SeedLabelTemplate,
} from "./seed-data-generators";
import { wouldCreateBlockCycle, hasExistingRelation, formatTaskIdentifier } from "../src/lib/relation-logic";

const prisma = new PrismaClient();
const rng = createSeededRng(42);

const KANBAN_STATE_ORDER = [
  "Backlog",
  "Ready",
  "In Progress",
  "Code Review",
  "Testing",
  "Blocked",
  "Done",
  "Cancelled",
] as const;
type KanbanStateName = (typeof KANBAN_STATE_ORDER)[number];

const STATE_COUNTS: Record<KanbanStateName, number> = {
  Backlog: 120,
  Ready: 60,
  "In Progress": 70,
  "Code Review": 40,
  Testing: 50,
  Blocked: 20,
  Done: 130,
  Cancelled: 10,
};

const DOMAINS: SeedLabelTemplate["domain"][] = ["Frontend", "Backend", "DevOps", "Process", "AI"];

interface ProjectContext {
  id: string;
  identifier: string;
  name: string;
  states: Map<KanbanStateName, string>; // name -> stateId
  labels: Array<{ id: string; name: string; domain: SeedLabelTemplate["domain"] }>;
  sprints: Array<{ id: string; index: number; status: SprintStatus; start: Date; end: Date }>;
  memberIds: string[];
}

interface SeedTaskRecord {
  id: string;
  projectId: string;
  sequenceId: number;
  stateName: KanbanStateName;
  createdAt: Date;
  dueDate: Date | null;
  domain: SeedLabelTemplate["domain"];
}

async function main(): Promise<void> {
  console.log("Cleaning up existing seed data...");
  await prisma.user.deleteMany({ where: { email: { in: SEED_USERS.map((u) => u.email) } } });

  console.log("Hashing shared password...");
  const hashedPassword = await bcrypt.hash("password123", 12);

  console.log("Seeding users...");
  const userIdByEmail = new Map<string, string>();
  for (const seedUser of SEED_USERS) {
    const user = await prisma.user.create({
      data: {
        name: seedUser.name,
        email: seedUser.email,
        hashedPassword,
      },
    });
    userIdByEmail.set(seedUser.email, user.id);
  }
  const adminUser = SEED_USERS.find((u) => u.role === "ADMIN");
  if (!adminUser) throw new Error("No ADMIN user found in SEED_USERS");
  const ownerId = userIdByEmail.get(adminUser.email);
  if (!ownerId) throw new Error("Owner id not resolved");
  const allUserIds = SEED_USERS.map((u) => userIdByEmail.get(u.email) as string);

  console.log("Seeding projects...");
  const projectIdByIdentifier = new Map<string, string>();
  for (const seedProject of SEED_PROJECTS) {
    const project = await prisma.project.create({
      data: {
        name: seedProject.name,
        identifier: seedProject.identifier,
        description: seedProject.description,
        ownerId,
      },
    });
    projectIdByIdentifier.set(seedProject.identifier, project.id);
  }

  console.log("Seeding project members...");
  const memberData = SEED_PROJECTS.flatMap((seedProject) => {
    const projectId = projectIdByIdentifier.get(seedProject.identifier) as string;
    return SEED_USERS.map((seedUser) => ({
      projectId,
      userId: userIdByEmail.get(seedUser.email) as string,
      role: seedUser.role,
    }));
  });
  await prisma.projectMember.createMany({ data: memberData });

  console.log("Seeding states...");
  const contexts = new Map<string, ProjectContext>();
  for (const seedProject of SEED_PROJECTS) {
    const projectId = projectIdByIdentifier.get(seedProject.identifier) as string;
    const stateMap = new Map<KanbanStateName, string>();
    for (const template of SEED_STATE_TEMPLATES) {
      const state = await prisma.state.create({
        data: {
          name: template.name,
          group: template.group,
          sequence: template.sequence,
          color: template.color,
          isDefault: template.isDefault ?? false,
          projectId,
        },
      });
      stateMap.set(template.name as KanbanStateName, state.id);
    }
    contexts.set(seedProject.identifier, {
      id: projectId,
      identifier: seedProject.identifier,
      name: seedProject.name,
      states: stateMap,
      labels: [],
      sprints: [],
      memberIds: allUserIds,
    });
  }

  console.log("Seeding labels...");
  for (const seedProject of SEED_PROJECTS) {
    const context = contexts.get(seedProject.identifier) as ProjectContext;
    for (let i = 0; i < SEED_LABEL_TEMPLATES.length; i++) {
      const template = SEED_LABEL_TEMPLATES[i];
      const color = LABEL_COLOR_PALETTE[i % LABEL_COLOR_PALETTE.length];
      const label = await prisma.label.create({
        data: {
          name: template.name,
          color,
          projectId: context.id,
        },
      });
      context.labels.push({ id: label.id, name: template.name, domain: template.domain });
    }
  }

  console.log("Seeding sprints...");
  for (const seedProject of SEED_PROJECTS) {
    const context = contexts.get(seedProject.identifier) as ProjectContext;
    const windows = buildSprintWindows();
    for (const window of windows) {
      const status: SprintStatus = window.index <= 8 ? "COMPLETED" : window.index === 9 ? "ACTIVE" : "DRAFT";
      const sprint = await prisma.sprint.create({
        data: {
          name: `Sprint ${window.index}`,
          startDate: window.start,
          endDate: window.end,
          status,
          projectId: context.id,
        },
      });
      context.sprints.push({ id: sprint.id, index: window.index, status, start: window.start, end: window.end });
    }
  }

  console.log("Building task state assignment plan...");
  const flatStatePlan: KanbanStateName[] = [];
  for (const stateName of KANBAN_STATE_ORDER) {
    for (let i = 0; i < STATE_COUNTS[stateName]; i++) {
      flatStatePlan.push(stateName);
    }
  }
  const shuffledStatePlan = rng.shuffle(flatStatePlan);

  console.log("Seeding tasks...");
  const allTaskRecords: SeedTaskRecord[] = [];
  let planCursor = 0;
  for (const seedProject of SEED_PROJECTS) {
    const context = contexts.get(seedProject.identifier) as ProjectContext;
    const projectStatePlan = shuffledStatePlan.slice(planCursor, planCursor + seedProject.taskCount);
    planCursor += seedProject.taskCount;

    const taskCreateData: Array<{
      title: string;
      description: string;
      priority: Priority;
      sequenceId: number;
      sortOrder: number;
      dueDate: Date | null;
      createdAt: Date;
      projectId: string;
      stateId: string;
    }> = [];

    const stateBucketCounters = new Map<KanbanStateName, number>();
    const perTaskState: KanbanStateName[] = [];
    const perTaskDomain: SeedLabelTemplate["domain"][] = [];

    for (let i = 0; i < projectStatePlan.length; i++) {
      const stateName = projectStatePlan[i];
      const sequenceId = i + 1;
      const type = rng.pickWeighted(TASK_TYPE_WEIGHTS);
      const domain = rng.pick(DOMAINS);
      const priority = rng.pickWeighted(PRIORITY_WEIGHTS);
      const includeChecklist = rng.bool(0.4);
      const includeAttachment = rng.bool(0.3);
      const title = generateTaskTitle(rng, type, domain);
      const description = generateTaskDescription(rng, { type, includeChecklist, includeAttachment });

      let createdAt: Date;
      if (stateName === "Backlog" || stateName === "Ready") {
        // skew later: sample from the back half of the range
        const midpoint = new Date(
          SEED_RANGE_START.getTime() + (SEED_RANGE_END.getTime() - SEED_RANGE_START.getTime()) * 0.5,
        );
        createdAt = randomDateBetween(rng, midpoint, SEED_RANGE_END);
      } else {
        createdAt = randomDateBetween(rng, SEED_RANGE_START, SEED_RANGE_END);
      }

      const dueDate: Date | null = rng.bool(0.6) ? randomDateBetween(rng, createdAt, SEED_RANGE_END) : null;

      const bucketIndex = stateBucketCounters.get(stateName) ?? 0;
      stateBucketCounters.set(stateName, bucketIndex + 1);
      const sortOrder = (bucketIndex + 1) * 1000;

      const stateId = context.states.get(stateName) as string;

      taskCreateData.push({
        title,
        description,
        priority,
        sequenceId,
        sortOrder,
        dueDate,
        createdAt,
        projectId: context.id,
        stateId,
      });
      perTaskState.push(stateName);
      perTaskDomain.push(domain);
    }

    const created = await prisma.task.createManyAndReturn({
      data: taskCreateData,
      select: { id: true, sequenceId: true, createdAt: true, dueDate: true },
    });

    // createManyAndReturn preserves input order in this Prisma version; map back by sequenceId to be safe.
    const bySequenceId = new Map(created.map((t) => [t.sequenceId, t]));
    for (let i = 0; i < taskCreateData.length; i++) {
      const input = taskCreateData[i];
      const row = bySequenceId.get(input.sequenceId);
      if (!row) throw new Error(`Failed to map back created task with sequenceId ${input.sequenceId}`);
      allTaskRecords.push({
        id: row.id,
        projectId: context.id,
        sequenceId: input.sequenceId,
        stateName: perTaskState[i],
        createdAt: row.createdAt,
        dueDate: row.dueDate,
        domain: perTaskDomain[i],
      });
    }
  }

  console.log("Seeding task labels...");
  const taskLabelPairs: Array<{ taskId: string; labelId: string }> = [];
  for (const task of allTaskRecords) {
    const context = contexts.get(
      SEED_PROJECTS.find((p) => projectIdByIdentifier.get(p.identifier) === task.projectId)?.identifier as string,
    ) as ProjectContext;
    const matchingLabels = context.labels.filter((l) => l.domain === task.domain);
    const labelCount = rng.int(1, 3);
    const chosen = new Set<string>();
    while (chosen.size < labelCount && chosen.size < context.labels.length) {
      // weighted toward labels matching the task's domain, falling back to any label
      const candidate = matchingLabels.length > 0 && rng.bool(0.75) ? rng.pick(matchingLabels) : rng.pick(context.labels);
      chosen.add(candidate.id);
    }
    for (const labelId of chosen) {
      taskLabelPairs.push({ taskId: task.id, labelId });
    }
  }
  await prisma.taskLabel.createMany({ data: taskLabelPairs });

  console.log("Seeding task assignees...");
  const taskAssigneePairs: Array<{ taskId: string; userId: string }> = [];
  const identifierByProjectId = new Map<string, string>();
  for (const [identifier, id] of projectIdByIdentifier.entries()) identifierByProjectId.set(id, identifier);

  for (const task of allTaskRecords) {
    const identifier = identifierByProjectId.get(task.projectId) as string;
    const context = contexts.get(identifier) as ProjectContext;
    let count: number;
    if (task.stateName === "Backlog" || task.stateName === "Cancelled") {
      count = rng.pickWeighted([
        { value: 0, weight: 70 },
        { value: 1, weight: 25 },
        { value: 2, weight: 5 },
      ]);
    } else if (
      task.stateName === "In Progress" ||
      task.stateName === "Code Review" ||
      task.stateName === "Testing" ||
      task.stateName === "Done"
    ) {
      count = rng.pickWeighted([
        { value: 0, weight: 10 },
        { value: 1, weight: 55 },
        { value: 2, weight: 35 },
      ]);
    } else {
      count = rng.pickWeighted([
        { value: 0, weight: 30 },
        { value: 1, weight: 50 },
        { value: 2, weight: 20 },
      ]);
    }
    const chosen = new Set<string>();
    const shuffledMembers = rng.shuffle(context.memberIds);
    for (let i = 0; i < count && i < shuffledMembers.length; i++) {
      chosen.add(shuffledMembers[i]);
    }
    for (const userId of chosen) {
      taskAssigneePairs.push({ taskId: task.id, userId });
    }
  }
  await prisma.taskAssignee.createMany({ data: taskAssigneePairs });

  console.log("Seeding sprint tasks...");
  const sprintTaskSet = new Set<string>();
  const sprintTaskPairs: Array<{ sprintId: string; taskId: string }> = [];
  for (const seedProject of SEED_PROJECTS) {
    const context = contexts.get(seedProject.identifier) as ProjectContext;
    const projectTasks = allTaskRecords.filter((t) => t.projectId === context.id);
    const nonBacklogTasks = projectTasks.filter((t) => t.stateName !== "Backlog");

    for (const sprint of context.sprints) {
      const isActiveOrDraft = sprint.status === "ACTIVE" || sprint.status === "DRAFT";
      const eligiblePool = isActiveOrDraft ? nonBacklogTasks : projectTasks;
      const targetCount = rng.int(40, 60);
      const shuffledPool = rng.shuffle(eligiblePool);
      let added = 0;
      for (const task of shuffledPool) {
        if (added >= targetCount) break;
        const key = `${sprint.id}:${task.id}`;
        if (sprintTaskSet.has(key)) continue;
        sprintTaskSet.add(key);
        sprintTaskPairs.push({ sprintId: sprint.id, taskId: task.id });
        added++;
      }
    }
  }
  await prisma.sprintTask.createMany({ data: sprintTaskPairs });

  console.log("Seeding task relations...");
  type InMemoryRelation = { sourceTaskId: string; targetTaskId: string; type: "BLOCKS" | "RELATES_TO" | "DUPLICATES" };
  const relationsByProject = new Map<string, InMemoryRelation[]>();
  for (const seedProject of SEED_PROJECTS) relationsByProject.set(seedProject.identifier, []);

  const identifierOf = (projectId: string): string => identifierByProjectId.get(projectId) as string;

  // 20 BLOCKS relations, one per Blocked task
  const blockedTasks = allTaskRecords.filter((t) => t.stateName === "Blocked");
  for (const blockedTask of blockedTasks) {
    const identifier = identifierOf(blockedTask.projectId);
    const projectRelations = relationsByProject.get(identifier) as InMemoryRelation[];
    const candidatePool = allTaskRecords.filter(
      (t) => t.projectId === blockedTask.projectId && t.id !== blockedTask.id && t.stateName !== "Done" && t.stateName !== "Cancelled",
    );
    const existingEdges = projectRelations.map((r) => ({ sourceTaskId: r.sourceTaskId, targetTaskId: r.targetTaskId }));
    const existingBlockEdges = projectRelations
      .filter((r) => r.type === "BLOCKS")
      .map((r) => ({ sourceTaskId: r.sourceTaskId, targetTaskId: r.targetTaskId }));

    let attempts = 0;
    let placed = false;
    while (attempts < 20 && !placed && candidatePool.length > 0) {
      attempts++;
      const source = rng.pick(candidatePool);
      if (source.id === blockedTask.id) continue;
      if (hasExistingRelation(existingEdges, source.id, blockedTask.id)) continue;
      if (wouldCreateBlockCycle(existingBlockEdges, source.id, blockedTask.id)) continue;
      const relation: InMemoryRelation = { sourceTaskId: source.id, targetTaskId: blockedTask.id, type: "BLOCKS" };
      projectRelations.push(relation);
      placed = true;
    }
    // if truly stuck after bounded retries, skip (should essentially never happen with 500 tasks)
  }

  // 80 RELATES_TO / DUPLICATES relations scattered across projects
  let scatteredCreated = 0;
  let scatteredAttempts = 0;
  while (scatteredCreated < 80 && scatteredAttempts < 4000) {
    scatteredAttempts++;
    const seedProject = rng.pick(SEED_PROJECTS);
    const context = contexts.get(seedProject.identifier) as ProjectContext;
    const projectTasks = allTaskRecords.filter((t) => t.projectId === context.id);
    if (projectTasks.length < 2) continue;
    const a = rng.pick(projectTasks);
    const b = rng.pick(projectTasks);
    if (a.id === b.id) continue;
    const projectRelations = relationsByProject.get(seedProject.identifier) as InMemoryRelation[];
    const existingEdges = projectRelations.map((r) => ({ sourceTaskId: r.sourceTaskId, targetTaskId: r.targetTaskId }));
    if (hasExistingRelation(existingEdges, a.id, b.id)) continue;
    const type = rng.bool(0.6) ? "RELATES_TO" : "DUPLICATES";
    projectRelations.push({ sourceTaskId: a.id, targetTaskId: b.id, type });
    scatteredCreated++;
  }

  const allRelations: InMemoryRelation[] = [];
  for (const relations of relationsByProject.values()) allRelations.push(...relations);

  const createdRelations = await prisma.taskRelation.createManyAndReturn({
    data: allRelations.map((r) => ({ sourceTaskId: r.sourceTaskId, targetTaskId: r.targetTaskId, type: r.type })),
    select: { id: true, sourceTaskId: true, targetTaskId: true, type: true },
  });

  console.log("Seeding comments...");
  const taskById = new Map(allTaskRecords.map((t) => [t.id, t]));
  const nonCancelledTasks = allTaskRecords.filter((t) => t.stateName !== "Cancelled");
  const commentData: Array<{ content: string; taskId: string; authorId: string; createdAt: Date }> = [];
  for (let i = 0; i < 1000; i++) {
    const task = rng.bool(0.9) ? rng.pick(nonCancelledTasks) : rng.pick(allTaskRecords);
    const identifier = identifierOf(task.projectId);
    const context = contexts.get(identifier) as ProjectContext;
    const authorId = rng.pick(context.memberIds);
    const includeAttachment = rng.bool(0.15);
    const content = generateCommentContent(rng, { includeAttachment });
    const createdAt = randomDateBetween(rng, task.createdAt, SEED_RANGE_END);
    commentData.push({ content, taskId: task.id, authorId, createdAt });
  }
  await prisma.comment.createMany({ data: commentData });

  console.log("Seeding activities...");
  interface ActivityInput {
    type: ActivityType;
    taskId: string;
    actorId: string;
    oldValue: string | null;
    newValue: string | null;
    metadata: string | null;
    createdAt: Date;
  }
  const activities: ActivityInput[] = [];

  const memberIdsOf = (projectId: string): string[] =>
    (contexts.get(identifierOf(projectId)) as ProjectContext).memberIds;

  // 500 TASK_CREATED, one per task
  for (const task of allTaskRecords) {
    const actorId = rng.pick(memberIdsOf(task.projectId));
    activities.push({
      type: "TASK_CREATED",
      taskId: task.id,
      actorId,
      oldValue: null,
      newValue: null,
      metadata: null,
      createdAt: task.createdAt,
    });
  }

  // 900 TASK_STATE_CHANGED, weighted toward tasks further along the pipeline
  const PROGRESS_WEIGHTS: Record<KanbanStateName, number> = {
    Backlog: 1,
    Ready: 2,
    "In Progress": 3,
    "Code Review": 4,
    Testing: 4,
    Blocked: 2,
    Done: 5,
    Cancelled: 3,
  };
  const progressWeight = (stateName: KanbanStateName): number => PROGRESS_WEIGHTS[stateName];
  const stateChangeWeighted = allTaskRecords.map((t) => ({ value: t, weight: progressWeight(t.stateName) }));
  for (let i = 0; i < 900; i++) {
    const task = rng.pickWeighted(stateChangeWeighted);
    const currentIdx = KANBAN_STATE_ORDER.indexOf(task.stateName);
    const oldIdx = currentIdx > 0 ? rng.int(0, currentIdx - 1 >= 0 ? currentIdx - 1 : 0) : 0;
    const oldValue = KANBAN_STATE_ORDER[Math.min(oldIdx, KANBAN_STATE_ORDER.length - 1)];
    const newValue = task.stateName;
    const actorId = rng.pick(memberIdsOf(task.projectId));
    const timestamp = randomDateBetween(rng, task.createdAt, SEED_RANGE_END);
    activities.push({
      type: "TASK_STATE_CHANGED",
      taskId: task.id,
      actorId,
      oldValue,
      newValue,
      metadata: null,
      createdAt: timestamp,
    });
  }

  // 250 TASK_ASSIGNEE_ADDED/REMOVED (~200 added / ~50 removed)
  for (let i = 0; i < 250; i++) {
    const isAdded = i < 200;
    const task = rng.pick(allTaskRecords);
    const members = memberIdsOf(task.projectId);
    const targetUser = rng.pick(SEED_USERS);
    const actorId = rng.pick(members);
    const timestamp = randomDateBetween(rng, task.createdAt, SEED_RANGE_END);
    activities.push({
      type: isAdded ? "TASK_ASSIGNEE_ADDED" : "TASK_ASSIGNEE_REMOVED",
      taskId: task.id,
      actorId,
      oldValue: null,
      newValue: null,
      metadata: JSON.stringify({ userName: targetUser.name }),
      createdAt: timestamp,
    });
  }

  // 150 TASK_PRIORITY_CHANGED
  const priorityValues: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];
  for (let i = 0; i < 150; i++) {
    const task = rng.pick(allTaskRecords);
    const oldValue = rng.pick(priorityValues);
    let newValue = rng.pick(priorityValues);
    if (newValue === oldValue) {
      newValue = priorityValues[(priorityValues.indexOf(oldValue) + 1) % priorityValues.length];
    }
    const actorId = rng.pick(memberIdsOf(task.projectId));
    const timestamp = randomDateBetween(rng, task.createdAt, SEED_RANGE_END);
    activities.push({
      type: "TASK_PRIORITY_CHANGED",
      taskId: task.id,
      actorId,
      oldValue,
      newValue,
      metadata: null,
      createdAt: timestamp,
    });
  }

  // 700 COMMENT_ADDED
  for (let i = 0; i < 700; i++) {
    const task = rng.pick(allTaskRecords);
    const actorId = rng.pick(memberIdsOf(task.projectId));
    const timestamp = randomDateBetween(rng, task.createdAt, SEED_RANGE_END);
    activities.push({
      type: "COMMENT_ADDED",
      taskId: task.id,
      actorId,
      oldValue: null,
      newValue: null,
      metadata: null,
      createdAt: timestamp,
    });
  }

  // 200 TASK_LABEL_ADDED
  for (let i = 0; i < 200; i++) {
    const task = rng.pick(allTaskRecords);
    const identifier = identifierOf(task.projectId);
    const context = contexts.get(identifier) as ProjectContext;
    const label = rng.pick(context.labels);
    const actorId = rng.pick(context.memberIds);
    const timestamp = randomDateBetween(rng, task.createdAt, SEED_RANGE_END);
    activities.push({
      type: "TASK_LABEL_ADDED",
      taskId: task.id,
      actorId,
      oldValue: null,
      newValue: null,
      metadata: JSON.stringify({ labelName: label.name }),
      createdAt: timestamp,
    });
  }

  // 200 TASK_SPRINT_ADDED
  for (let i = 0; i < 200; i++) {
    const task = rng.pick(allTaskRecords);
    const identifier = identifierOf(task.projectId);
    const context = contexts.get(identifier) as ProjectContext;
    const sprint = rng.pick(context.sprints);
    const actorId = rng.pick(context.memberIds);
    const timestamp = randomDateBetween(rng, task.createdAt, SEED_RANGE_END);
    activities.push({
      type: "TASK_SPRINT_ADDED",
      taskId: task.id,
      actorId,
      oldValue: null,
      newValue: null,
      metadata: JSON.stringify({ sprintName: `Sprint ${sprint.index}` }),
      createdAt: timestamp,
    });
  }

  // 100 TASK_RELATION_ADDED, one per created relation
  for (const relation of createdRelations) {
    const sourceTask = taskById.get(relation.sourceTaskId);
    if (!sourceTask) continue;
    const targetTask = taskById.get(relation.targetTaskId);
    if (!targetTask) continue;
    const identifier = identifierOf(sourceTask.projectId);
    const actorId = rng.pick(memberIdsOf(sourceTask.projectId));
    const timestamp = randomDateBetween(rng, sourceTask.createdAt, SEED_RANGE_END);
    activities.push({
      type: "TASK_RELATION_ADDED",
      taskId: relation.sourceTaskId,
      actorId,
      oldValue: null,
      newValue: null,
      metadata: JSON.stringify({ targetIdentifier: formatTaskIdentifier(identifier, targetTask.sequenceId) }),
      createdAt: timestamp,
    });
  }

  await prisma.activity.createMany({ data: activities });

  console.log("Fetching final counts...");
  const [
    userCount,
    projectCount,
    stateCount,
    labelCount,
    sprintCount,
    taskCount,
    taskLabelCount,
    taskAssigneeCount,
    sprintTaskCount,
    taskRelationCount,
    commentCount,
    activityCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.state.count(),
    prisma.label.count(),
    prisma.sprint.count(),
    prisma.task.count(),
    prisma.taskLabel.count(),
    prisma.taskAssignee.count(),
    prisma.sprintTask.count(),
    prisma.taskRelation.count(),
    prisma.comment.count(),
    prisma.activity.count(),
  ]);

  console.log("\n=== Seed Summary ===");
  console.log(
    `Users: ${userCount}, Projects: ${projectCount}, States: ${stateCount}, Labels: ${labelCount}, Sprints: ${sprintCount}, Tasks: ${taskCount}, Comments: ${commentCount}, Activities: ${activityCount}`,
  );
  console.log(
    `TaskLabel links: ${taskLabelCount}, TaskAssignee links: ${taskAssigneeCount}, SprintTask links: ${sprintTaskCount}, TaskRelations: ${taskRelationCount}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
