---
name: pulse-feature-pipeline
description: Flexible orchestrator for implementing an Antigravity feature spec in Pulse. Detects which layers the spec actually touches (DB, server actions, pure lib logic, client UI, routes/pages), delegates only to the matching subagents in dependency order, skips layers with no work, then verifies with npm test + tsc and calls debugger only on failure. Use when the user hands over an Antigravity prompt/spec or asks to implement a Pulse step or feature end-to-end.
---

# Pulse Feature Pipeline Skill

Turns an Antigravity spec into a **minimal** subagent plan. It is not a fixed six-step chain: every layer must earn its subagent from evidence in the spec. Past steps show why:

| Step | Layers actually needed |
| :--- | :--- |
| 5.01 Domain Event Foundation | `postgres-pro` (enums) + `typescript-pro` (pure logic) |
| 5.02 Dependency Automation | `backend-developer` + `typescript-pro` |
| 5.03 Progress Request Lifecycle | `postgres-pro` + `typescript-pro` + `backend-developer` + `react-specialist` (slide-over UI, no new route, so no `nextjs-developer`) |

---

## Phase 1: Layer Detection (no subagents yet)

Read the spec and any test files Antigravity has already added under `src/lib/__tests__/` (read-only). Mark a layer **ACTIVE** only with concrete evidence:

| Layer | Subagent | ACTIVE when the spec… |
| :--- | :--- | :--- |
| DB | `postgres-pro` | adds or changes a `model`, `enum`, enum value, relation, index, migration, or seed data |
| Pure logic | `typescript-pro` | names functions in `src/lib/*.ts`, or new tests import a `src/lib` module that doesn't exist or lacks the tested exports |
| Actions | `backend-developer` | adds or changes files in `src/actions/`, permission checks, `$transaction`, `logActivity`, notification triggers, or post-transaction hooks |
| Client UI | `react-specialist` | adds or changes `"use client"` components, modals, popovers, optimistic state, or dnd |
| Routes | `nextjs-developer` | adds a route under `src/app/`, or changes a `page.tsx`/`layout.tsx`/`loading.tsx`, params/searchParams, or server-side data loading for a page |

Rules:
- Unclear evidence means **inactive**. You can add a layer later if a real gap appears; an idle subagent wastes tokens.
- A spec change that fits one layer and a couple of files: **do it inline** and skip subagents entirely.
- Print the plan before delegating:
  ```
  Layers: DB ✅ · Logic ✅ · Actions ✅ · UI ❌ (no UI in spec) · Routes ❌ (no new route)
  Order: postgres-pro → typescript-pro → backend-developer
  ```

## Phase 2: Ordered Delegation

Canonical order (skip inactive layers, keep the rest in this order):

`postgres-pro` → `typescript-pro` → `backend-developer` → `react-specialist` → `nextjs-developer`

- **Sequential by default**, because each layer consumes the previous one (Prisma types → lib types → action signatures → component props → page wiring).
- **Parallel only when provably independent**, e.g. `typescript-pro` logic that imports no new Prisma types can run alongside `postgres-pro`. When in doubt, go sequential.
- If DB is active, run `npx prisma generate` (and the migration via `postgres-pro`) before any later layer starts.

Each subagent prompt must be **self-contained and narrow**:
1. Only the slice of the spec for that layer, not the whole spec.
2. The handoff from earlier layers: exact file paths, exported names, and signatures created. Don't make it rediscover them.
3. Relevant invariants from `AGENTS.md` (e.g. `requireMembership`, `revalidatePath`, `logActivity` inside `$transaction`, non-blocking notifications).
4. Hard rules, stated every time:
   - Never create, modify, or delete files in `src/lib/__tests__/` or `prisma/migrations/` (hookify blocks this anyway).
   - No `npm install` of new dependencies.
   - Report back: files changed plus the exported names and signatures later layers need.

After each subagent returns, record its handoff in one or two lines. Pass that forward, not the raw transcript.

## Phase 3: Verification (inline first, debugger on failure)

Run it yourself. Don't spawn a subagent for green checks:
```bash
npm test
npx tsc --noEmit
```
- Both green: done. Skip `debugger`.
- Any failure: delegate to `debugger` with the exact failing test names or tsc errors, and the files changed in Phase 2. Reminder: fix production code, never tests.
- Re-run both commands after the debugger returns. Stop after **2** debugger rounds without progress and report to the user instead of looping.

## Phase 4: Handoff

1. Run the `pulse-step-closeout` skill for the standard sign-off report.
2. Run the `pulse-context-sync` skill (dry run, then `--write` if drift) so counters match the new test/model totals.
3. Don't commit unless the user asks.

## Output Format
```markdown
### 🧩 Pulse Feature Pipeline Summary
- **Spec:** [Step X.YY — title]
- **Layers Run:** postgres-pro → typescript-pro → backend-developer
- **Layers Skipped:** react-specialist (no UI), nextjs-developer (no route) 
- **Files Changed:** `prisma/schema.prisma`, `src/lib/...`, `src/actions/...`
- **Verification:** ✅ [N] tests · ✅ tsc 0 errors · debugger rounds: [0]
- **Next:** pulse-step-closeout ✅ · pulse-context-sync ✅
```
