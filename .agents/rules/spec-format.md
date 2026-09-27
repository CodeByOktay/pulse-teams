---
trigger: model_decision
---

# SPEC Authoring Standard

**Scope:** Apply this standard whenever you write, review, revise, or hand over an implementation specification (SPEC) for a coding agent (`docs/spec/` in Pulse; executed by Claude Code). Paths below are Pulse defaults; in another project, keep the rules and use that project's own paths if it defines them.

Baseline: **ISO/IEC/IEEE 29148** (well-formed requirements: necessary, singular, unambiguous, complete, feasible, verifiable) + **EARS** (requirement syntax) + **Given/When/Then** (acceptance criteria) + **RFC 2119** (MUST/SHALL keywords) + **spec-driven development** as in GitHub Spec Kit and Kiro (requirements → design → tasks, explicit clarification markers, traceability).

## 1. Purpose and Boundary

A SPEC tells the implementer **what to build and how it will be verified**, precisely enough that two independent implementers would pass the same tests. It is the single source of truth for one step.

| Content | Belongs in |
|---|---|
| Requirements, acceptance criteria, contracts, task breakdown, verification | **SPEC** |
| Why an architectural option was chosen | **ADR** (must be `accepted` before the SPEC is approved; link it) |
| Current system state the implementer must respect | **AI-context** (link the domain files to read) |
| Test code | Test suites (authored by Antigravity only; the SPEC names them) |

## 2. File Conventions

- **Location & name:** `docs/spec/vX.Y.Z-step-N.NN.md` (target version + step). Reference it as `SPEC vX.Y.Z-step-N.NN`.
- **One step per SPEC.** If it exceeds ~15K characters or touches more than two domains deeply, split the step.
- **Language:** English (the executed artifact). Antigravity first presents a Turkish review summary to the project owner in chat; the SPEC file is written in English after approval. Identifiers, paths, and enum values exactly as in code.
- **Links:** relative paths only. Never `file:///` or absolute local paths.
- **Commands:** cross-platform (`cd agent && pytest`), never OS-specific paths such as `agent\.venv\Scripts\pytest`.
- Keep `docs/spec/README.md` as the index. Each SPEC's own `status` field is authoritative.

## 3. Lifecycle

`draft → approved → in-progress → implemented` (or `superseded by SPEC …`)

- `draft`: Antigravity writes it; all `[NEEDS CLARIFICATION: …]` markers must be resolved before approval.
- `approved`: only the project owner approves. All referenced ADRs are `accepted`.
- `in-progress`: the implementer is working on it.
- `implemented`: all acceptance criteria pass, verification is green, sign-off done.
- After approval, changes are allowed only by appending an entry to the **Revisions** section (date, what changed, why) and re-approval. Never silently rewrite approved requirements.

## 4. Writing Requirements

- Each requirement has a stable ID (`REQ-001`, `NFR-001`) and states **one** capability (singular).
- Use EARS patterns; `SHALL` marks the obligation:
  - Ubiquitous: `The <component> SHALL <response>.`
  - Event-driven: `WHEN <trigger>, the <component> SHALL <response>.`
  - State-driven: `WHILE <state>, the <component> SHALL <response>.`
  - Unwanted behaviour: `IF <error condition>, THEN the <component> SHALL <response>.`
  - Optional feature: `WHERE <feature is enabled>, the <component> SHALL <response>.`
- Give **exact values**: thresholds, defaults, time zones, limits, message texts, error behaviour. Mark configurable values with their source (e.g. `AgentSettings.config.<key>`, default `15`).
- Forbidden vague words: "fast", "user-friendly", "appropriate", "as needed", "etc.", "and/or", "if possible", "support", "handle". Replace them with measurable behaviour.
- Non-functional requirements (`NFR-`) are measurable: idempotency window, max query count, max latency, authorization rule, failure isolation.
- Cover edge cases explicitly: empty/zero, duplicates, concurrency, permission denied, deleted/missing records, time boundaries.

## 5. Acceptance Criteria and Contracts

- Every requirement has ≥ 1 acceptance criterion (`AC-001`) in **Given / When / Then** form, testable without interpretation.
- Every AC names the test suite that will verify it (authored by Antigravity), e.g. `src/lib/__tests__/<suite>.test.ts`, `agent/tests/test_<x>.py`.
- **Public contracts are specified, internals are not.** Signatures of pure functions under `src/lib/` that tests import, server action names, API routes, request/response and event payload shapes, and schema changes MUST be exact. Private helpers and internal structure are left to the implementer.
- The SPEC instructs the implementer **not to write, modify, or delete tests**, and to keep business logic in pure functions under `src/lib/`.

## 6. Definition of Ready (before `approved`)

- [ ] Referenced ADRs are `accepted`; AI-context files to read are listed.
- [ ] In-scope and out-of-scope are explicit.
- [ ] Every REQ is singular, unambiguous, verifiable, and has ≥ 1 AC mapped to a test suite.
- [ ] Contracts (signatures, routes, payloads, schema) are exact.
- [ ] Tasks are ordered by layer dependency and map to REQs.
- [ ] Zero `[NEEDS CLARIFICATION]` markers remain.

## 7. SPEC Template

````markdown
---
spec: vX.Y.Z-step-N.NN
title: <Short title>
status: draft                 # draft | approved | in-progress | implemented | superseded by SPEC …
date: YYYY-MM-DD
phase-step: "Phase N / Step N.NN"
author: Antigravity
approver: <human project owner>
implementer: Claude Code
adrs: [ADR-NNN]               # all must be accepted
depends-on: [SPEC vX.Y.Z-step-N.NN]
ai-context: [<domain-slug>]   # files the implementer must read first
layers: [db, logic, actions, ui, routes, agent]   # only the ones touched
---

# SPEC vX.Y.Z — Step N.NN: <Title>

## 1. Summary
<2–3 sentences: the outcome this step delivers and for whom.>

## 2. Scope
**In scope:**
- <…>

**Out of scope (non-goals):**
- <…>

## 3. Requirements
### Functional
- **REQ-001** — WHEN <trigger>, the <component> SHALL <response>.
- **REQ-002** — IF <error condition>, THEN the <component> SHALL <response>.

### Non-Functional
- **NFR-001** — <measurable constraint: idempotency, authorization, performance, failure isolation>.

## 4. Acceptance Criteria
| ID | Given | When | Then | Covers | Test suite |
|---|---|---|---|---|---|
| AC-001 | <state> | <action/event> | <observable result> | REQ-001 | `src/lib/__tests__/<suite>.test.ts` |

## 5. Design and Contracts
### Data Model Changes
<Prisma models/enums/fields/indexes/migration name — or "None".>

### Contracts
```ts
// src/lib/<file>.ts — imported by tests; signature is binding
export function <name>(<params>): <ReturnType>;
```
- Server actions: `<name>(<params>)` — guard: `requireMembership` | `requireAdmin`
- API: `POST /api/internal/<route>` — request `{…}`, response `{…}`, auth: HMAC
- Events: `<DomainEvent type>` — payload `{…}`

### Invariants to Preserve
- <Existing invariants from AGENTS.md / AI-context that this change MUST NOT break.>

## 6. Tasks (ordered by layer dependency)
1. **[db]** <task> — files: `prisma/schema.prisma` — REQ-00x
2. **[logic]** <task> — files: `src/lib/<file>.ts` — REQ-00x
3. **[actions]** <task> — files: `src/actions/<file>.ts` — REQ-00x
4. **[ui]** <task> — files: `src/components/<…>` — REQ-00x
5. **[agent]** <task> — files: `agent/src/<…>.py` — REQ-00x

Rules for the implementer: do not create, modify, or delete test files; do not add dependencies without the owner's consent.

## 7. Verification
```bash
npm test
npx tsc --noEmit
cd agent && pytest
```
Done when all AC test suites pass, the full suites stay green, and type checking reports zero errors.

## 8. Open Questions
- [NEEDS CLARIFICATION: <question>]  ← must be empty before approval

## 9. Revisions
| Date | Change | Reason |
|---|---|---|
````

## 8. Review Anti-Patterns (reject or fix)

- Requirements without IDs, or several behaviours in one sentence.
- Ambiguous alternatives in a rule ("baseline is X or 1"), missing defaults, or vague words.
- Acceptance criteria that only say "tests pass".
- Missing out-of-scope section; scope creep discovered during implementation.
- Exact internals dictated while public contracts are left vague.
- OS-specific commands, `file:///` links, or old ADR file names.
- Status tracked only in the index while the SPEC itself says something else.
- Approved requirements edited without a Revisions entry.
