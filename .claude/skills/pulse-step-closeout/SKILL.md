---
name: pulse-step-closeout
description: Executes the end-of-step verification and closeout pipeline for Pulse. Runs Vitest test suites, verifies zero TypeScript compilation errors, checks Prisma schema/migration status, inspects git changes, and produces a standardized sign-off report for Antigravity.
---

# Pulse Step Closeout Skill

Use this skill at the end of every feature, phase, or step increment in Pulse to guarantee operational hygiene, 100% test pass rate, and zero type regressions before handing over to Antigravity.

---

## Execution Pipeline

Perform the following steps sequentially. If any step fails, halt the pipeline and report the failure immediately.

### Step 1: Run Full Vitest Test Suite
Execute the test suite using bash/shell:
```bash
npm test
```
- **Requirement:** 100% of tests must pass (e.g., 468+ tests). Zero failures permitted.
- **Fail-Safe:** If any test fails:
  - 🛑 **STOP.**
  - Identify the failing test name and failure reason.
  - ⚠️ **Strict Policy:** Claude must NEVER modify, mock-bypass, or delete files under `src/lib/__tests__/`. Fix the production code under `src/` until the test passes.

### Step 2: TypeScript Strict Compilation Check
Execute type checking:
```bash
npx tsc --noEmit
```
- **Requirement:** Must exit with code 0 and output zero TypeScript errors.
- **Fail-Safe:** If errors exist, list the file paths, line numbers, and error codes. Fix them before proceeding.

### Step 3: Database & Migration Consistency
Check git status for database changes:
```bash
git status --porcelain
```
- Inspect if `prisma/schema.prisma` has uncommitted modifications:
  - If modified: Verify if `npx prisma migrate dev` was executed and generated client (`npx prisma generate`).
  - ⚠️ **Strict Policy:** Claude must NEVER manually edit existing files in `prisma/migrations/`.

### Step 4: Verification & Metrics Summary
Compare the test results with `AGENTS.md`:
- Check total test count and test suite count reported by Vitest.
- Note if `AGENTS.md` or `context.md` need a count update (e.g. "X tests, Y suites, 100% passing").

---

## Output Format

Once all checks pass, output the following structured report:

```markdown
### 🏁 Pulse Step Closeout Report

- **Target Step / Feature:** [Step Name, e.g. Step 5.02 — Dependency Automation]
- **Vitest Suite:** ✅ ALL PASS ([Count] tests passed across [Suites] suites)
- **TypeScript (`tsc`):** ✅ 0 Errors
- **Prisma Schema / DB:** ✅ Up to date / [Migrated]
- **Modified Production Files:**
  - `src/...`
- **Git State:** [Clean / Uncommitted changes list]
- **Antigravity Handover:** Ready for QA sign-off, ADR generation, and docs/ai-context synchronization.
```
