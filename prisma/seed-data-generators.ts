import type { Priority, StateGroup } from "@prisma/client";

export interface SeededRng {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  pickWeighted<T>(items: ReadonlyArray<{ value: T; weight: number }>): T;
  shuffle<T>(arr: readonly T[]): T[];
  bool(probability: number): boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRng(seed: number): SeededRng {
  const random = mulberry32(seed);

  const next = (): number => random();

  const int = (min: number, max: number): number =>
    Math.floor(next() * (max - min + 1)) + min;

  const float = (min: number, max: number): number => next() * (max - min) + min;

  const pick = <T>(arr: readonly T[]): T => arr[int(0, arr.length - 1)];

  const pickWeighted = <T>(items: ReadonlyArray<{ value: T; weight: number }>): T => {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let point = next() * total;
    for (const item of items) {
      point -= item.weight;
      if (point <= 0) {
        return item.value;
      }
    }
    return items[items.length - 1].value;
  };

  const shuffle = <T>(arr: readonly T[]): T[] => {
    const result = arr.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i);
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  };

  const bool = (probability: number): boolean => next() < probability;

  return { next, int, float, pick, pickWeighted, shuffle, bool };
}

export type SeedUserRole = "ADMIN" | "MEMBER";

export interface SeedUser {
  name: string;
  email: string;
  role: SeedUserRole;
  title: string;
}

export const SEED_USERS: SeedUser[] = [
  { name: "Ahmet Yılmaz", email: "admin@pulse.local", role: "ADMIN", title: "Product Owner" },
  { name: "Ayşe Kaya", email: "ayse@pulse.local", role: "MEMBER", title: "Scrum Master" },
  { name: "Mehmet Demir", email: "mehmet@pulse.local", role: "MEMBER", title: "Engineering Manager" },
  { name: "Zeynep Çelik", email: "zeynep@pulse.local", role: "MEMBER", title: "Senior Backend Developer" },
  { name: "Can Arslan", email: "can@pulse.local", role: "MEMBER", title: "Backend Developer" },
  { name: "Burak Şahin", email: "burak@pulse.local", role: "MEMBER", title: "Backend Developer" },
  { name: "Elif Aydın", email: "elif@pulse.local", role: "MEMBER", title: "Lead Frontend Developer" },
  { name: "Mert Aksoy", email: "mert@pulse.local", role: "MEMBER", title: "Frontend Developer" },
  { name: "Seda Korkmaz", email: "seda@pulse.local", role: "MEMBER", title: "QA / Test Automation Engineer" },
  { name: "Emre Eren", email: "emre@pulse.local", role: "MEMBER", title: "DevOps / SRE Engineer" },
];

export interface SeedProject {
  name: string;
  identifier: string;
  description: string;
  taskCount: number;
}

export const SEED_PROJECTS: SeedProject[] = [
  {
    name: "Pulse Core Platform",
    identifier: "CORE",
    description: "The foundational Kanban engine, task model, and permission system that every other Pulse surface builds on top of.",
    taskCount: 120,
  },
  {
    name: "Pulse Analytics",
    identifier: "ANL",
    description: "Dashboards, KPI reporting, and sprint velocity tooling that give teams visibility into how work is actually flowing.",
    taskCount: 100,
  },
  {
    name: "Pulse AI Assistant",
    identifier: "AI",
    description: "An in-app assistant that summarizes tasks, drafts comments, and suggests prioritization using retrieval-augmented generation.",
    taskCount: 90,
  },
  {
    name: "Pulse Administration",
    identifier: "ADM",
    description: "Workspace administration, member management, billing, and audit tooling for organization owners and admins.",
    taskCount: 110,
  },
  {
    name: "Pulse Mobile Experience",
    identifier: "MOB",
    description: "A native-feeling mobile companion app for triaging tasks, reviewing sprints, and receiving notifications on the go.",
    taskCount: 80,
  },
];

export interface SeedStateTemplate {
  name: string;
  group: StateGroup;
  sequence: number;
  color: string;
  isDefault?: boolean;
}

export const SEED_STATE_TEMPLATES: SeedStateTemplate[] = [
  { name: "Backlog", group: "BACKLOG", sequence: 10000, color: "#60646C", isDefault: true },
  { name: "Ready", group: "TODO", sequence: 20000, color: "#3A3F47" },
  { name: "In Progress", group: "IN_PROGRESS", sequence: 30000, color: "#3B82F6" },
  { name: "Code Review", group: "IN_PROGRESS", sequence: 40000, color: "#8B5CF6" },
  { name: "Testing", group: "IN_PROGRESS", sequence: 50000, color: "#F59E0B" },
  { name: "Blocked", group: "TODO", sequence: 60000, color: "#EF4444" },
  { name: "Done", group: "DONE", sequence: 70000, color: "#10B981" },
  { name: "Cancelled", group: "CANCELLED", sequence: 80000, color: "#94A3B8" },
];

export interface SeedLabelTemplate {
  name: string;
  domain: "Frontend" | "Backend" | "DevOps" | "Process" | "AI";
}

export const SEED_LABEL_TEMPLATES: SeedLabelTemplate[] = [
  { name: "react", domain: "Frontend" },
  { name: "nextjs", domain: "Frontend" },
  { name: "tailwind", domain: "Frontend" },
  { name: "ui", domain: "Frontend" },
  { name: "ux", domain: "Frontend" },
  { name: "accessibility", domain: "Frontend" },
  { name: "api", domain: "Backend" },
  { name: "database", domain: "Backend" },
  { name: "prisma", domain: "Backend" },
  { name: "performance", domain: "Backend" },
  { name: "security", domain: "Backend" },
  { name: "caching", domain: "Backend" },
  { name: "docker", domain: "DevOps" },
  { name: "azure", domain: "DevOps" },
  { name: "deploy", domain: "DevOps" },
  { name: "monitoring", domain: "DevOps" },
  { name: "ci-cd", domain: "DevOps" },
  { name: "kubernetes", domain: "DevOps" },
  { name: "kpi", domain: "Process" },
  { name: "sprint", domain: "Process" },
  { name: "analytics", domain: "Process" },
  { name: "dashboard", domain: "Process" },
  { name: "reporting", domain: "Process" },
  { name: "documentation", domain: "Process" },
  { name: "llm", domain: "AI" },
  { name: "prompt", domain: "AI" },
  { name: "embedding", domain: "AI" },
  { name: "recommendation", domain: "AI" },
  { name: "assistant", domain: "AI" },
  { name: "evaluation", domain: "AI" },
];

export const LABEL_COLOR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
  "#14b8a6",
] as const;

export type SeedTaskType = "Feature" | "Bug" | "Improvement" | "Research" | "Spike" | "Documentation";

export const TASK_TYPE_WEIGHTS: ReadonlyArray<{ value: SeedTaskType; weight: number }> = [
  { value: "Feature", weight: 60 },
  { value: "Bug", weight: 15 },
  { value: "Improvement", weight: 10 },
  { value: "Research", weight: 5 },
  { value: "Spike", weight: 5 },
  { value: "Documentation", weight: 5 },
];

const TITLE_ACTION_PATTERNS: Record<SeedTaskType, readonly string[]> = {
  Feature: [
    "Implement {subject}",
    "Add {subject}",
    "Build {subject}",
    "Introduce {subject}",
    "Enable {subject}",
    "Create {subject}",
    "Ship {subject}",
    "Launch {subject}",
    "Design {subject}",
    "Develop {subject}",
    "Integrate {subject}",
    "Support {subject}",
    "Deliver {subject}",
    "Roll out {subject}",
    "Bootstrap {subject}",
    "Scaffold {subject}",
    "Wire up {subject}",
    "Set up {subject}",
    "Provision {subject}",
    "Expose {subject}",
  ],
  Bug: [
    "Fix {subject}",
    "Resolve {subject}",
    "Patch {subject}",
    "Correct {subject}",
    "Address {subject}",
    "Eliminate {subject}",
    "Fix race condition in {subject}",
    "Fix memory leak in {subject}",
    "Fix crash in {subject}",
    "Fix regression in {subject}",
    "Handle edge case in {subject}",
    "Fix incorrect behavior in {subject}",
    "Fix broken {subject}",
    "Repair {subject}",
    "Debug {subject}",
    "Resolve intermittent failure in {subject}",
    "Fix validation error in {subject}",
    "Fix timeout issue in {subject}",
    "Fix data inconsistency in {subject}",
    "Fix null pointer exception in {subject}",
  ],
  Improvement: [
    "Optimize {subject}",
    "Refactor {subject}",
    "Improve performance of {subject}",
    "Simplify {subject}",
    "Streamline {subject}",
    "Enhance {subject}",
    "Clean up {subject}",
    "Reduce latency in {subject}",
    "Modernize {subject}",
    "Consolidate {subject}",
    "Harden {subject}",
    "Tune {subject}",
    "Upgrade {subject}",
    "Standardize {subject}",
    "Decouple {subject}",
    "Restructure {subject}",
    "Polish {subject}",
    "Rework {subject}",
    "Deduplicate logic in {subject}",
    "Increase test coverage for {subject}",
  ],
  Research: [
    "Evaluate {subject}",
    "Investigate {subject}",
    "Research best practices for {subject}",
    "Compare alternatives for {subject}",
    "Assess feasibility of {subject}",
    "Explore options for {subject}",
    "Benchmark {subject}",
    "Analyze {subject}",
    "Study {subject}",
    "Survey existing solutions for {subject}",
    "Prototype {subject}",
    "Review tradeoffs of {subject}",
    "Investigate root cause of {subject}",
    "Explore migration path for {subject}",
    "Assess impact of {subject}",
    "Gather requirements for {subject}",
    "Validate assumptions about {subject}",
    "Scope out {subject}",
    "Determine approach for {subject}",
    "Audit {subject}",
  ],
  Spike: [
    "Spike on {subject}",
    "Time-box investigation into {subject}",
    "Quick spike: {subject}",
    "Proof of concept for {subject}",
    "Prototype spike for {subject}",
    "Technical spike on {subject}",
    "Feasibility spike for {subject}",
    "De-risk {subject}",
    "Spike: evaluate {subject}",
    "Short spike on {subject}",
    "Explore feasibility of {subject}",
    "Spike investigation on {subject}",
    "Throwaway prototype for {subject}",
    "Spike: measure {subject}",
    "Spike on alternative approach to {subject}",
    "Spike: validate {subject} approach",
    "Spike on scaling {subject}",
    "Spike: {subject} performance",
    "Spike on replacing {subject}",
    "Spike: risk assessment for {subject}",
  ],
  Documentation: [
    "Document {subject}",
    "Write documentation for {subject}",
    "Update docs for {subject}",
    "Add README for {subject}",
    "Create onboarding guide for {subject}",
    "Write architecture doc for {subject}",
    "Document API for {subject}",
    "Add inline comments to {subject}",
    "Write runbook for {subject}",
    "Create changelog entry for {subject}",
    "Write migration guide for {subject}",
    "Document configuration for {subject}",
    "Add usage examples for {subject}",
    "Write troubleshooting guide for {subject}",
    "Update wiki page for {subject}",
    "Write ADR for {subject}",
    "Document deployment process for {subject}",
    "Create diagram for {subject}",
    "Write style guide for {subject}",
    "Document testing strategy for {subject}",
  ],
};

const DOMAIN_SUBJECTS: Record<SeedLabelTemplate["domain"], readonly string[]> = {
  Frontend: [
    "the dashboard UI",
    "the Kanban board drag-and-drop",
    "the task detail modal",
    "the login form",
    "the responsive layout",
    "the dark mode theme",
    "the sidebar navigation",
    "the command palette",
    "the filter chips",
    "the markdown editor toolbar",
    "the date picker component",
    "the avatar rendering logic",
    "the toast notification system",
    "the infinite scroll list",
    "the accessibility of form inputs",
    "the client-side routing",
    "the skeleton loading states",
    "the drag handle styling",
    "the responsive breakpoints",
    "the keyboard navigation in popovers",
  ],
  Backend: [
    "the task assignment API",
    "the sprint completion endpoint",
    "the Prisma query for board filters",
    "the activity logging service",
    "the authentication middleware",
    "the rate limiting logic",
    "the bulk update endpoint",
    "the search indexing job",
    "the comment creation flow",
    "the webhook delivery system",
    "the database connection pool",
    "the caching layer for project stats",
    "the pagination logic",
    "the task relation validation",
    "the invite token generation",
    "the audit log query",
    "the transaction handling in bulk actions",
    "the N+1 query in the task list",
    "the server action for label management",
    "the background job scheduler",
  ],
  DevOps: [
    "the CI pipeline",
    "the Docker build process",
    "the Azure deployment workflow",
    "the Kubernetes health checks",
    "the production monitoring dashboard",
    "the log aggregation pipeline",
    "the staging environment provisioning",
    "the database backup job",
    "the container image size",
    "the secrets management setup",
    "the autoscaling configuration",
    "the blue-green deployment strategy",
    "the alerting rules",
    "the infrastructure-as-code templates",
    "the load balancer configuration",
    "the CDN cache invalidation",
    "the rollback automation",
    "the uptime SLA monitoring",
    "the canary release process",
    "the resource quota limits",
  ],
  Process: [
    "the sprint retrospective template",
    "the KPI reporting dashboard",
    "the velocity tracking chart",
    "the release checklist",
    "the backlog grooming process",
    "the standup notes template",
    "the stakeholder reporting workflow",
    "the definition of done",
    "the sprint planning agenda",
    "the roadmap timeline view",
    "the team capacity planning",
    "the OKR tracking process",
    "the incident postmortem template",
    "the onboarding checklist",
    "the cross-team sync process",
    "the quarterly review deck",
    "the analytics reporting cadence",
    "the risk register",
    "the change management process",
    "the project health scorecard",
  ],
  AI: [
    "the LLM prompt template",
    "the embedding generation pipeline",
    "the recommendation engine",
    "the AI assistant response formatting",
    "the prompt injection guardrails",
    "the model evaluation harness",
    "the vector search index",
    "the fine-tuning dataset",
    "the chat completion streaming",
    "the assistant's tool-calling logic",
    "the token usage tracking",
    "the retrieval-augmented generation flow",
    "the hallucination detection heuristic",
    "the model latency benchmarking",
    "the prompt versioning system",
    "the AI feedback loop",
    "the context window management",
    "the semantic caching layer",
    "the assistant's conversation memory",
    "the model fallback strategy",
  ],
};

export function generateTaskTitle(
  rng: SeededRng,
  type: SeedTaskType,
  domain: SeedLabelTemplate["domain"]
): string {
  const pattern = rng.pick(TITLE_ACTION_PATTERNS[type]);
  const subject = rng.pick(DOMAIN_SUBJECTS[domain]);
  const phrase = pattern.replace("{subject}", subject);
  return `[${type}] ${phrase}`;
}

const DESCRIPTION_PARAGRAPHS: Record<SeedTaskType, readonly string[]> = {
  Feature: [
    "This feature introduces a new capability requested by multiple stakeholders during the last planning session. The implementation should follow existing architectural patterns and integrate cleanly with the current permission model.",
    "Users have asked for this functionality repeatedly in feedback sessions. We should ship an MVP first and iterate based on usage data.",
    "This is part of the broader initiative to improve the core product experience. Coordination with the design team will be required before implementation begins.",
    "A straightforward addition that extends existing functionality without introducing breaking changes. Should be fully covered by unit and integration tests before merging.",
    "This feature unlocks a key workflow for power users and is expected to reduce support tickets related to manual workarounds.",
    "Requested by the engineering manager after the last retrospective. Keep the implementation simple and avoid over-engineering for edge cases that may never occur.",
    "This builds on top of work completed in a previous sprint. Please review the related pull request before starting implementation.",
    "A customer-facing improvement that should be demoed in the next sprint review. Accessibility and mobile responsiveness must be considered from the start.",
  ],
  Bug: [
    "Reported by a user in production and confirmed by the QA team. Steps to reproduce are attached; please prioritize given the impact on active users.",
    "This bug was caught during regression testing before the last release. It appears to be related to a recent refactor of the affected module.",
    "Intermittent issue reported by multiple team members. Logs suggest a race condition under concurrent load; further investigation is needed.",
    "A regression introduced in the last deploy. Rolling back is not an option due to dependent changes, so a proper fix is required.",
    "Customer support flagged this as a recurring complaint. The root cause seems to be an unhandled edge case in the validation logic.",
    "Discovered while investigating an unrelated issue. Low severity but should be fixed before it compounds with other known issues.",
    "This causes incorrect data to be displayed under specific conditions. A fix should include a regression test to prevent recurrence.",
    "Flagged by automated monitoring after an unusual spike in error rates. Needs investigation before it escalates further.",
  ],
  Improvement: [
    "The current implementation works but has accumulated technical debt that is starting to slow down development velocity. This refactor should not change external behavior.",
    "Performance profiling revealed this as a bottleneck under heavier load. The goal is to reduce latency without sacrificing correctness.",
    "Code review feedback from the last few pull requests pointed to this area as needing cleanup. A good opportunity to add missing test coverage as well.",
    "This improvement is part of an ongoing effort to reduce complexity across the codebase. Coordinate with the team before making sweeping changes.",
    "Identified during a recent architecture review as a candidate for simplification. Should result in fewer edge cases and easier maintenance going forward.",
    "Minor but impactful change that will improve developer experience for the whole team. Low risk, should be straightforward to implement and test.",
    "Follow-up work from a previous incident postmortem. Strengthening this area should prevent similar issues from recurring.",
    "This has been on the backlog for a while and is now a priority given upcoming scaling requirements.",
  ],
  Research: [
    "Before committing to an implementation approach, we need to understand the tradeoffs between the available options. Findings should be documented and shared with the team.",
    "This research task will inform the technical design for an upcoming feature. Please summarize findings in a short write-up with a clear recommendation.",
    "We need more data before deciding how to proceed here. Timebox this to avoid analysis paralysis.",
    "Exploratory work to validate assumptions made during initial planning. Results will directly influence the scope of follow-up implementation tasks.",
    "The team is divided on the best approach, so this research should provide enough evidence to make an informed decision.",
    "This investigation is a prerequisite for several downstream tasks. Please prioritize and share preliminary findings early.",
    "A deep dive is needed to understand the root cause before any fix can be properly scoped. Document findings for future reference.",
  ],
  Spike: [
    "A short, timeboxed investigation to reduce uncertainty before committing engineering resources. The outcome should be a clear go/no-go recommendation.",
    "This spike will validate technical feasibility ahead of the next planning cycle. Keep the scope tight and avoid building production-ready code.",
    "We need a quick proof of concept to de-risk the upcoming milestone. Results should be shared in the next sprint review.",
    "A throwaway prototype intended purely to answer specific technical questions. Do not worry about code quality or test coverage for this spike.",
    "This spike is meant to surface unknowns early so the team can plan more accurately. Document any blockers discovered along the way.",
    "Time-boxed to two days maximum. The goal is confidence in the chosen approach, not a finished implementation.",
  ],
  Documentation: [
    "Existing documentation for this area is outdated and no longer matches the current implementation. This should be corrected to reduce onboarding friction for new engineers.",
    "New team members have repeatedly asked about this area, indicating a gap in our documentation. A clear, concise write-up would help.",
    "Part of the ongoing effort to keep internal documentation in sync with the codebase. Should include examples where relevant.",
    "This documentation will be referenced by both engineering and support teams, so clarity and accuracy are especially important.",
    "Following the recent architecture changes, related documentation needs to be updated to avoid confusion during future development.",
    "A lightweight documentation task that should not require significant engineering time, just clear writing and a final review.",
  ],
};

const CHECKLIST_ITEMS: Record<SeedTaskType, readonly string[]> = {
  Feature: [
    "Design API contract",
    "Implement backend logic",
    "Build UI components",
    "Write unit tests",
    "Write integration tests",
    "Update documentation",
    "Add feature flag",
    "QA sign-off",
    "Accessibility review",
    "Update changelog",
  ],
  Bug: [
    "Reproduce the issue locally",
    "Identify root cause",
    "Implement fix",
    "Add regression test",
    "Verify fix in staging",
    "Update related documentation",
    "Notify affected users",
    "Monitor after deploy",
  ],
  Improvement: [
    "Profile current performance",
    "Refactor implementation",
    "Add missing test coverage",
    "Update documentation",
    "Benchmark before/after",
    "Code review",
    "Remove dead code",
    "Verify no behavior change",
  ],
  Research: [
    "Define research questions",
    "Collect data / benchmarks",
    "Evaluate alternatives",
    "Document findings",
    "Present recommendation to team",
    "Identify follow-up tasks",
  ],
  Spike: [
    "Define spike scope and timebox",
    "Build throwaway prototype",
    "Validate technical approach",
    "Document results",
    "Share go/no-go recommendation",
    "Clean up spike branch",
  ],
  Documentation: [
    "Outline document structure",
    "Write first draft",
    "Add code examples",
    "Technical review",
    "Publish to wiki",
    "Link from related pages",
  ],
};

const ATTACHMENT_NAME_BASES = [
  "architecture-diagram",
  "mockup",
  "sequence-diagram",
  "wireframe",
  "flow-chart",
  "before-after-comparison",
  "test-report",
  "performance-graph",
  "er-diagram",
  "ui-screenshot",
] as const;

function toTitleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildAttachmentLine(rng: SeededRng): string {
  const base = rng.pick(ATTACHMENT_NAME_BASES);
  const version = rng.int(1, 5);
  const fileName = `${base}-v${version}.png`;
  const isImage = rng.bool(0.5);
  const url = `https://pulse-assets.local/${isImage ? "mockups" : "attachments"}/${fileName}`;
  return isImage ? `\n\n![${toTitleCase(base)}](${url})` : `\n\n📎 [${fileName}](${url})`;
}

function buildChecklistBlock(rng: SeededRng, type: SeedTaskType): string {
  const pool = CHECKLIST_ITEMS[type];
  const count = rng.int(3, Math.min(5, pool.length));
  const items = rng.shuffle(pool).slice(0, count);
  const lines = items.map((item, index) => {
    const checked = index === 0 ? false : rng.bool(0.5);
    return `- [${checked ? "x" : " "}] ${item}`;
  });
  return `\n\n**Yapılacaklar:**\n${lines.join("\n")}`;
}

export function generateTaskDescription(
  rng: SeededRng,
  opts: { type: SeedTaskType; includeChecklist: boolean; includeAttachment: boolean }
): string {
  let result = rng.pick(DESCRIPTION_PARAGRAPHS[opts.type]);
  if (opts.includeChecklist) {
    result += buildChecklistBlock(rng, opts.type);
  }
  if (opts.includeAttachment) {
    result += buildAttachmentLine(rng);
  }
  return result;
}

const COMMENT_PHRASES = [
  "LGTM, nice work on this!",
  "Can you add a test case for the empty state here?",
  "This looks good, just left a couple of nitpicks inline.",
  "Blocked on the API changes from the backend team, will pick this back up once that's merged.",
  "I think we should reconsider the approach here — happy to pair on it tomorrow.",
  "Verified the fix locally, works as expected.",
  "Ship it 🚀",
  "Left some comments on naming, otherwise solid.",
  "Can we get a design review before merging this?",
  "This is failing in CI, could you take a look?",
  "Great catch, this was a subtle bug.",
  "Do we need to update the docs for this change as well?",
  "Approving, but let's follow up on the TODO in a separate ticket.",
  "I'm seeing different behavior locally, can you double check?",
  "Nice, this simplifies the logic a lot.",
  "Let's hold off on merging until QA signs off.",
  "Can you rebase on main? There are some conflicts now.",
  "This matches what we discussed in standup, thanks!",
  "Small nit: can we extract this into a helper function?",
  "Tested on staging, everything looks good.",
  "This might need a follow-up for the mobile layout.",
  "Good point, updated based on your feedback.",
  "Do we have monitoring in place for this before we ship it?",
  "This is ready for another pass whenever you have time.",
] as const;

export function generateCommentContent(rng: SeededRng, opts?: { includeAttachment?: boolean }): string {
  const base = rng.pick(COMMENT_PHRASES);
  if (opts?.includeAttachment && rng.bool(0.5)) {
    return base + buildAttachmentLine(rng);
  }
  return base;
}

export const PRIORITY_WEIGHTS: ReadonlyArray<{ value: Priority; weight: number }> = [
  { value: "NONE", weight: 10 },
  { value: "LOW", weight: 25 },
  { value: "MEDIUM", weight: 35 },
  { value: "HIGH", weight: 20 },
  { value: "URGENT", weight: 10 },
];

export const SEED_RANGE_START: Date = new Date("2026-01-01T00:00:00Z");
export const SEED_RANGE_END: Date = new Date("2026-05-20T23:59:59Z");

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function randomDateBetween(rng: SeededRng, start: Date, end: Date): Date {
  return new Date(start.getTime() + rng.next() * (end.getTime() - start.getTime()));
}

export interface SprintWindow {
  index: number;
  start: Date;
  end: Date;
}

export function buildSprintWindows(rangeStart: Date = SEED_RANGE_START): SprintWindow[] {
  const windows: SprintWindow[] = [];
  for (let i = 0; i < 10; i++) {
    const start = addDays(rangeStart, i * 14);
    const end = addDays(start, 13);
    windows.push({ index: i + 1, start, end });
  }
  return windows;
}
