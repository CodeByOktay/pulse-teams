---
trigger: model_decision
description: "Use when proposing, writing, reviewing, superseding or deprecating an Architecture Decision Record (ADR-NNN) for Pulse, or when deciding whether a change needs an ADR at all."
---

# ADR Authoring Standard — Pulse

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

- **Location:** `docs/wiki/`
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
