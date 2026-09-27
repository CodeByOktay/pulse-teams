# ADR Authoring Standard

**Scope:** Apply this standard whenever you propose, write, review, supersede, or deprecate an Architecture Decision Record (ADR), or decide whether a change needs one. Paths below are Pulse defaults; in another project, keep the rules and use that project's own paths if it defines them.

Baseline: **MADR 4.0** (structure) + **Nygard** (status, value-neutral context, honest consequences) + **ISO/IEC/IEEE 42010** (rationale: drivers, alternatives, trade-offs) + **Y-Statement** (one-sentence summary) + **ecADR** (definition of done).

## 1. Purpose and Boundary

An ADR records **one architecturally significant decision**: the problem, the options considered, the choice, the reasons for it, and the trade-offs. It is written for **humans** (the project owner, future contributors, reviewers).

An ADR is NOT an implementation report, a spec, a changelog, or AI memory. Route content to the right document:

| Content | Belongs in |
|---|---|
| Why X was chosen over Y, trade-offs, what we accept | **ADR** |
| What to build: layers, files, acceptance criteria, task breakdown | **SPEC** (`docs/spec/`) |
| What was built, current system state, invariants for AI recall | **ai-context** (`docs/ai-context/`) |
| Test counts, test run output, changed-file lists, UI polish details | Step closeout report / `CHANGELOG.md` |
| Full Prisma models, directory trees, long code | SPEC or the code itself. An ADR may quote a short excerpt (≤ 15 lines) only when the decision cannot be understood without it |

## 2. When an ADR Is Required

Write an ADR when the decision meets **at least one** of these:
- Changes system structure (new container/service/layer, communication or integration pattern).
- Affects a key quality attribute: security, data integrity, reliability, performance, cost, testability.
- Adds, replaces, or removes a dependency, external service, or cross-cutting data-model concept.
- Creates or changes an architectural invariant listed in `AGENTS.md`.
- Is hard or expensive to reverse.

Do NOT write an ADR for UI polish, bug fixes, refactors that keep the architecture, or choices already covered by an accepted ADR. **Steps are not ADRs:** a step may produce zero, one, or several ADRs.

## 3. Granularity

- **One decision per ADR.** If a design contains independent decisions (e.g., runtime, scheduler, communication protocol), write separate ADRs and link them via `related`.
- Exception: tightly coupled decisions that cannot be accepted or rejected independently may share one ADR (max 3). Each keeps its own options and outcome.
- Phased decisions (short/mid/long term) get one ADR per phase.

## 4. File Conventions

- **Location:** `docs/wiki/` (Pulse)
- **File name:** `ADR-NNN-kebab-case-ascii-slug.md`
  - `NNN` = next free 3-digit, zero-padded number. Numbers are never reused, even for rejected ADRs.
  - Slug: lowercase ASCII, words joined by `-`, no spaces. Transliterate Turkish characters (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u).
  - The `.md` extension is mandatory.
  - Example: `ADR-035-event-driven-blocker-escalation.md`
- **H1 title:** `# ADR-NNN: <Turkish title>` naming both the problem and the solution, ≤ 80 characters.
- **Links:** relative paths only (`./ADR-028-....md`, `../spec/...`, `../../src/lib/authz.ts`). **Never** use `file:///` or absolute local paths.
- **Language:** body in Turkish. Section headings in Turkish with the canonical English term in parentheses. Code identifiers, enum values, file paths, and technology names stay exactly as written in code.
- **Length:** aim for 1–3 printed pages (≈ 4–10K characters). If it grows longer, it most likely contains several decisions or spec content; split it.

## 5. Lifecycle and Status

```
proposed ──► accepted ──► deprecated
    │            └──────► superseded by ADR-NNN
    └──────► rejected
```

- Antigravity drafts the ADR as `proposed` **during architectural analysis, before the SPEC is written.**
- **Only the human project owner** moves an ADR to `accepted` or `rejected`. AI agents never self-accept. Antigravity and Claude Code are listed under `consulted`, not as `decision-makers`.
- A SPEC that implements a decision may only be issued after its ADR is `accepted`.
- **Append-only:** once `accepted`, the body is frozen. Allowed edits: `status`, `superseded-by`, `date` (of the status change), typo fixes, and new links. If the decision changes, write a new ADR with `supersedes: [ADR-old]` and set the old one to `superseded by ADR-new`.
- If implementation proves the decision wrong, do not rewrite it; supersede it.
- Rejected ADRs are kept; they document why a path was not taken.

## 6. Writing Rules

- **Context** states facts neutrally: current state with concrete numbers and constraints. No advocacy. End with the question being decided.
- **Decision** is written in active voice ("X'i seçiyoruz, çünkü…") and cites the decision drivers it satisfies.
- At least **two genuine options**. Include "keep status quo" when it is realistic. Do not invent straw-man options.
- Every option lists at least one **Bad** point. Consequences include at least one **negative** consequence or cost. Hiding trade-offs is a defect.
- State **confidence** honestly (`high | medium | low`). Low-confidence decisions must define a revisit trigger.
- Be pithy and factual. The ADR must stand alone. Link to supplementary material instead of embedding it.

## 7. Definition of Done (ecADR) — check before requesting acceptance

- [ ] **E — Evidence:** there is a reason to believe the chosen option works (existing codebase pattern, PoC, official documentation, benchmark), and it is cited.
- [ ] **C — Criteria & Alternatives:** decision drivers are stated and used to compare ≥ 2 options.
- [ ] **A — Agreement:** the human owner's approval is recorded (`status: accepted`, `date`).
- [ ] **D — Documentation:** the template is complete, the Y-Statement is present, and negative consequences are visible.
- [ ] **R — Realization/Review:** the *Confirmation* section names concrete tests or checks, and a revisit trigger is defined.

## 8. Template

````markdown
---
status: proposed              # proposed | accepted | rejected | deprecated | superseded by ADR-NNN
date: YYYY-MM-DD              # date of the last status change
decision-makers: [<human project owner>]
consulted: [Antigravity, Claude Code]
informed: []
version: v0.X.Y
phase-step: "Phase N / Step N.NN"
supersedes: []                # e.g. [ADR-028]
superseded-by: null
related: []                   # e.g. [ADR-029, SPEC v0.6.3-step-6.04]
confidence: high              # high | medium | low
---

# ADR-NNN: <Problemi ve çözümü anlatan kısa başlık>

## Özet (Y-Statement)

<Bağlam/kullanım senaryosu> bağlamında, <sorun/kaygı> ile karşı karşıyayken
<seçilen seçenek> seçeneğini seçtik, <reddedilen seçenekler> seçeneklerini değil;
böylece <kazanılan kalite/hedef> sağlanır, <kabul edilen bedel/dezavantaj> kabul edilerek.

## Bağlam ve Problem Tanımı (Context and Problem Statement)

<2–5 kısa paragraf. Mevcut durum, somut sayılar, kısıtlar. Tarafsız dil.>
<Karara bağlanan soru ile bitir: "…nasıl yapılmalı?">

## Karar Etkenleri (Decision Drivers)

- <Etken 1: ör. veri bütünlüğü, test edilebilirlik, maliyet, geri alınabilirlik>
- <Etken 2>

## Değerlendirilen Seçenekler (Considered Options)

1. <Seçenek 1>
2. <Seçenek 2>
3. <Seçenek 3 / Mevcut durumu koru>

## Karar (Decision Outcome)

Seçilen seçenek: **"<Seçenek N>"**, çünkü <hangi etkenleri en iyi karşıladığı / eleyici kriter>.

### Sonuçlar (Consequences)

- **Olumlu:** <…>
- **Olumsuz:** <… — en az bir tane zorunlu>
- **Nötr:** <…>

### Doğrulama (Confirmation)

- **Test:** `src/lib/__tests__/<suite>.test.ts` / `agent/tests/<test>.py` — <korunan invariant>
- **Tip kontrolü:** `npx tsc --noEmit`
- **İnceleme:** <review sırasında kontrol edilecek somut kural>

## Seçeneklerin Artı ve Eksileri (Pros and Cons of the Options)

### <Seçenek 1>

- İyi, çünkü <…>
- Nötr, çünkü <…>
- Kötü, çünkü <…>

### <Seçenek 2>

- İyi, çünkü <…>
- Kötü, çünkü <…>

## Ek Bilgiler (More Information)

- **Kanıt / Kaynaklar:** <dokümantasyon, mevcut kod deseni, PoC bağlantısı>
- **Yeniden değerlendirme tetikleyicisi:** <hangi koşulda bu karar tekrar açılır>
- **İlgili:** <göreli bağlantılar: ADR, SPEC, ai-context>
````

## 9. Review Anti-Patterns (reject or fix)

- Implementation report disguised as an ADR (file lists, test output, UI details, "Faz X — Teknik Rapor").
- A "decision" with no real alternatives (post-hoc justification).
- Several unrelated decisions bundled in one file.
- Only positive consequences.
- `file:///` links; file names without `.md`, or containing spaces or Turkish characters.
- Editing the body of an accepted ADR instead of superseding it.
- An AI agent listed as the sole decision-maker.

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
