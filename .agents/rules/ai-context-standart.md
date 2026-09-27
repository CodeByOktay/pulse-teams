---
trigger: model_decision
---

# AI-Context Authoring Standard

**Scope:** Apply this standard whenever you create, update, review, or reorganize AI-context documents (`docs/ai-context/` in Pulse). They are the project's persistent memory for AI agents. Paths below are Pulse defaults; in another project, keep the rules and use that project's own paths if it defines them.

Baseline: **Anthropic context engineering** (smallest set of high-signal tokens, just-in-time loading, structured notes) + **AGENTS.md open format** (plain Markdown, layered files) + **llms.txt** (index format) + **Diátaxis** (AI-context is *reference*, not history or explanation) + **context-rot / AGENTS.md evaluation research** (long or unnecessary context lowers agent accuracy; keep only minimal, non-obvious requirements).

## 1. Purpose and Boundary

AI-context documents describe the **current state** of the system so an agent can work correctly without re-reading the whole codebase. They are **living reference documents**: updated in place, always true for the current `main`.

| Content | Belongs in |
|---|---|
| What exists **now**: responsibilities, entry points, invariants, contracts, pitfalls | **AI-context** |
| Why it was designed this way | **ADR** (link it, never copy it) |
| What to build next, acceptance criteria | **SPEC** |
| What changed, when, and test run results | `CHANGELOG.md` / git history |
| Build commands, stack, global conventions, project-wide counters | Tier-0 file (`AGENTS.md`) |

## 2. Layered Structure (Progressive Disclosure)

- **Tier 0 — always loaded:** `AGENTS.md` (+ `CLAUDE.md` / `GEMINI.md`). Short, project-wide facts only. It links to the index; it does not duplicate domain detail.
- **Tier 1 — index:** `docs/ai-context/system-overview.md` in **llms.txt format**: H1 project name, `>` one-paragraph summary, H2 groups, and one line per file: `- [domain](./domain.md): what it covers and when to read it`. Keep it ≤ 3K characters.
- **Tier 2 — domain files, loaded just-in-time:** one file per **domain / bounded area** (e.g., `authz.md`, `task-relations.md`, `notifications.md`, `agent-runtime.md`), **never per step**. A step updates the domain files it touched. Add a new file only when a new domain appears.

## 3. File Conventions

- **Name:** `docs/ai-context/<domain-slug>.md` — lowercase ASCII kebab-case, no number prefix. File names are independent of ADR and SPEC numbers.
- **Language:** English. Identifiers, paths, enum values exactly as in code, in backticks.
- **Size budget:** a domain file ≤ ~6K characters (~1.5K tokens). If larger, split the domain.
- **Links:** relative paths only. Never `file:///` or absolute local paths.

## 4. Writing Rules

- Write **present-tense facts** about the current system. No narrative ("in this step we…"), no history ("previously…"), no marketing adjectives ("robust", "premium", "seamless").
- Record only what an agent **cannot cheaply infer** from the code: invariants, cross-file contracts, non-obvious constraints, pitfalls, locations of entry points. Do not restate what a file's code already says plainly.
- State invariants with **MUST / MUST NOT / NEVER** (RFC 2119) and cite the enforcing function and test suite, e.g. `NEVER insert reverse BLOCKS rows — enforced by hasExistingRelation (task-relations.test.ts)`.
- **Single source of truth per fact.** A fact lives in exactly one file; others link to it.
- **No volatile counters** (test counts, model counts, suite counts) in domain files. They live only in Tier 0 and are synced by script (`pulse-context-sync`).
- Code excerpts ≤ 10 lines, only for contracts (type signatures, payload shapes). Link to the source for the rest.
- Delete statements that are no longer true. An outdated line is worse than a missing one.

## 5. Update Procedure (at step sign-off, after tests are green)

1. List the domains the step touched (from the SPEC and the diff).
2. For each, edit the domain file in place: add new facts, **rewrite or delete** outdated ones.
3. Verify every path and identifier you mention exists in the code (search for it). Remove any that do not.
4. Update frontmatter: `last-verified`, `version`, `sources`, `related`.
5. Update the index if a file was added, renamed, or its scope changed.
6. Sync Tier-0 counters with the script; do not hand-edit numbers.
7. Check for contradictions between Tier 0, the index, and domain files. Fix them in the same change.

## 6. Domain File Template

````markdown
---
domain: <domain-slug>
status: current               # current | deprecated
last-verified: YYYY-MM-DD
version: v0.X.Y
sources:                      # primary code locations this file describes
  - src/lib/<file>.ts
  - src/actions/<file>.ts
related: [ADR-NNN, SPEC vX.Y.Z-step-N.NN]
---

# <Domain Name> — AI Context

> <One or two sentences: what this domain does and its boundary with neighbouring domains.>

## Entry Points
- `src/lib/<file>.ts` — `<functionName>`: <role in one line>
- `src/actions/<file>.ts` — `<actionName>`: <role; auth guard used>

## Data Model
- `<Model>`: <only non-obvious fields, relations, constraints (unique keys, onDelete)>
- `<Enum>`: <values and meaning, if not self-explanatory>

## Invariants
- MUST <rule> — enforced by `<function>` (`<suite>.test.ts`)
- NEVER <rule> — enforced by `<function>` (`<suite>.test.ts`)

## Flows
1. <Trigger> → <step> → <step> → <result> (name the functions)

## Integration Points
- Emits: <DomainEvent type / notification / activity>
- Consumes: <event or API>
- Calls / called by: <other domain> via `<function>`

## Pitfalls
- <Non-obvious trap and the correct approach>
````

## 7. Review Anti-Patterns (reject or fix)

- Step-based snapshot files (`NNN-feature.md`) that freeze history and contradict newer files.
- Hard-coded totals such as "Total Test Count: 468" in domain files.
- The same fact repeated across `AGENTS.md`, `CONTEXT.md`, and domain files, with diverging values.
- Paths or identifiers that no longer exist in the code.
- Copied ADR rationale instead of a link.
- Narrative, history, or promotional wording.
- Files over the size budget, or an index that is not in llms.txt format.
