---
name: pulse-context-sync
description: Deterministically syncs numeric counters (test count, suite count, per-suite counts, Prisma model/enum counts, enum value counts) in AGENTS.md, context.md and docs/ai-context/system-overview.md against the real repo state. Script-driven regex replacement of digits only — no free-form LLM text generation. Use after a step closes out, or when the user asks to sync/refresh counters or fix context drift.
---

# Pulse Context Sync Skill

Keeps the numeric counters in Pulse's context docs aligned with reality (tests in `src/lib/__tests__/`, models/enums in `prisma/schema.prisma`).

## Core Rule — Deterministic Only

- ✅ All changes come from `scripts/sync-counters.mjs`. It replaces **digits inside known counter phrases** and nothing else.
- ❌ Do NOT hand-edit, rephrase, summarize, or "improve" any prose in these files as part of this skill.
- ❌ Do NOT add or remove list entries, feature descriptions, phase notes, or version numbers. The script reports those under "Needs manual attention"; relay them to the user / Antigravity.
- ❌ Never touch numbered snapshots `docs/ai-context/NNN-*.md` or historical milestone counts (e.g. `Step 5.01 ... (448 tests)`, `Total Phase 3: 331`). They record history, not current state. The script's patterns are anchored so those lines never match.

## Pipeline

### Step 1: Dry run
```bash
node .claude/skills/pulse-context-sync/scripts/sync-counters.mjs
```
- Runs `vitest run --reporter=json` (exact counts, including `it.each` expansions) and parses `prisma/schema.prisma`.
- Prints ground truth, every drifted counter as `file:line [rule] old -> new`, and manual-attention warnings.
- If the output says tests are **FAILING**, stop. Do not sync. Fix the production code first (see `pulse-step-closeout`).

### Step 2: Apply
If there is drift and tests pass:
```bash
node .claude/skills/pulse-context-sync/scripts/sync-counters.mjs --write
```
The script refuses to write (exit 2) while any test fails, because the docs claim "100% passing".

### Step 3: Verify
```bash
git diff --stat -- AGENTS.md context.md docs/ai-context/system-overview.md
git diff -- AGENTS.md context.md docs/ai-context/system-overview.md
```
Confirm the diff contains **only digit changes**. If anything else changed, revert that file with `git checkout -- <file>` and report it as a script bug.

## Flags
| Flag | Effect |
| :--- | :--- |
| *(none)* | Dry run: report only |
| `--write` | Apply changes |
| `--check` | Report and exit 1 on drift (CI / pre-commit use) |
| `--static` | Count `it(`/`test(` by regex without running vitest. Faster, but undercounts `it.each` suites. Use only when vitest cannot run, and say so in the report. |

## Counter Patterns Covered
| Phrase (digits updated) | Source of truth |
| :--- | :--- |
| `N Models across`, `Database Models (N)` | `model` blocks in schema |
| `Enums (N)` | `enum` blocks in schema |
| `<EnumName> (N values` | Values inside that enum block |
| `N tests across M suites` (any case) | vitest JSON |
| `N tests passing across M test suites` | vitest JSON |
| `Total: **N tests`, `**Total:** **N tests` | vitest JSON |
| `pass 100% (N tests)` | vitest JSON |
| `N Vitest tests are passing 100%` | vitest JSON |
| `` `file.test.ts` (N) `` / `` `file.test.ts` (N tests) `` | Per-suite vitest count |

To cover a new counter phrase, add an anchored rule to the `rules` array in the script. Do not fall back to editing by hand.

## Output Format
```markdown
### 🔄 Pulse Context Sync Report
- **Ground Truth:** [N] tests / [M] suites · [X] models / [Y] enums
- **Counters Updated:** [count] (file:line old → new …) / None — already in sync
- **Needs Manual Attention:** [missing/stale suite listings, or "None"]
- **Diff Check:** ✅ digits only
```
