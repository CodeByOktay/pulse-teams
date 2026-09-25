# Pulse — AI Progress Interpretation & AgentProposal Architecture (ADR-032)

## Overview
Pulse introduces AI-assisted progress interpretation and human-in-the-loop proposal approval. When an assignee submits a natural language progress response (`ProgressResponse`), the system analyzes the message (via configured LLM provider or fallback heuristic engine) to deduce task status changes and blocker signals, generating an `AgentProposal`. Authorized project members review and approve proposals via the task slide-over UI, applying state changes and triggering cascading unblocking automations.

- **Milestone:** Phase 5, Step 5.04 (`v0.5.4` — Phase 5 MVP Completed)
- **ADR Reference:** `ADR-032-AI Destekli İlerleme Yorumlama ve Onaylı Güncelleme Mimarisi`
- **Database Models (1 new -> 19 total):** `AgentProposal`
- **Enums (1 new -> 9 total):** `ProposalStatus` (`PENDING`, `APPROVED`, `REJECTED`, `STALE`)
- **Database Migration:** `prisma/migrations/20260925194439_add_agent_proposal_model/`
- **Provider-Agnostic LLM Layer:** `src/lib/ai/`
  - `llm-types.ts`: Provider contract and configuration interface
  - `llm-config.ts`: Pure config resolution supporting `.env` and `ai.config.json`
  - `providers/openai-compatible.ts`: Generic HTTP completions client
  - `interpreter.ts`: Safe orchestrator with zero-failure guarantee
- **Pure Domain Logic:** `src/lib/ai-proposal-logic.ts` (`interpretProgressHeuristic`, `matchSuggestedStateId`, `isProposalStale`, `extractJsonObject`, `buildInterpretationPrompt`)
- **Server Actions:** `src/actions/agent-proposal.ts` (`generateProposalForResponse`, `approveProposal`, `rejectProposal`, `getTaskProposals`)
- **UI Components:** `src/components/task-detail/agent-proposal-card.tsx` integrated into `task-progress-section.tsx`
- **Test Suite:** `src/lib/__tests__/ai-proposal-logic.test.ts` (26 tests)
- **Total Test Count:** 514 tests across 26 suites (100% passing)

---

## Architectural Invariants & Guarantees

1. **Provider-Agnostic & Zero-Hardcoding:**
   - No vendor SDK or proprietary endpoint is hardcoded in the codebase.
   - Endpoint, model, version, auth scheme, and extra headers are resolved dynamically from environment or configuration.
   - AI remains off when endpoint/model are unset or placeholders (`<...>`, `CHANGE_ME`, `your-...`).

2. **Zero-Failure AI Fallback (Resilience Guarantee):**
   - The interpreter never throws exceptions to the caller.
   - When external LLM is not configured, unreachable, or times out (>8s), the deterministic `interpretProgressHeuristic` handles Turkish keywords seamlessly (`bitti`, `tamamlandı` -> DONE; `kaldı`, `sürüyor` -> IN_PROGRESS; `engel`, `bloke` -> blocker detected).

3. **Human-in-the-Loop (Approval-Gated Mutation):**
   - AI never directly mutates task state or database records.
   - All mutations pass through an explicit human review step (`approveProposal` or `rejectProposal`).
   - Approvers can optionally override the AI's suggested state prior to applying.

4. **Stale Proposal Guard:**
   - Proposals verify that `status === "PENDING"` and that the task hasn't already moved to the suggested state or been modified by another user concurrently.

5. **Cascading Post-Transaction Hook:**
   - Approving an AI proposal that transitions a task to `DONE` automatically triggers `triggerUnblockedDependencies`, unblocking dependent tasks and notifying their assignees.
