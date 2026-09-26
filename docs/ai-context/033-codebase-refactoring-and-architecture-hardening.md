# Pulse — Codebase Refactoring & Architecture Hardening (ADR-033)

## Overview
Pulse executed a comprehensive, 4-wave full-stack refactoring and hardening cycle following the completion of the Phase 5 MVP. The refactoring improved algorithmic performance, eliminated subtle security vulnerabilities (cross-tenant invite IDOR), aligned client state synchronization with React 19 standards, and closed test coverage gaps with 14 new unit tests.

- **Milestone:** Phase 5, Post-MVP Hardening (`v0.5.4` Refactoring Milestone)
- **ADR Reference:** `ADR-033-Kapsamli Kod Refaktoru ve Mimari Saglamlastirma`
- **Total Test Count:** 528 tests across 27 suites (100% passing)
- **Production Build:** Validated (`npm run build` succeeds in 3.9s across all App Router pages)

---

## 4-Wave Refactoring Execution Summary

### Wave 1: Pure Domain Logic Layer (`src/lib/`)
- `project-analytics-logic.ts`:
  - Reduced daily 3x `.filter` scans in `calculateBurndownSeries` to a single pass `countTasksForDay` loop ($O(3 \times N \times \text{Days}) \rightarrow O(N \times \text{Days})$).
  - Extracted pure math utilities: `idealRemainingForDay`, `mean`, `round1`, and `elapsedDays`.
- `relation-logic.ts`:
  - Iterative DFS cycle detector `wouldCreateBlockCycle` separated adjacency construction into `buildAdjacencyList`.
  - Streamlined relation grouping via `resolveGroupKey`.
- `board-filters.ts`:
  - Normalized URL query parser with generic `pickValid` and `pickOne` helpers.
  - Eliminated redundant `Date` allocations in `endOfWeek`.
- **Test Hardening (Antigravity Exclusive):**
  - Authored `src/lib/__tests__/project-analytics-logic.test.ts` (14 tests) covering burndowns, velocity trends, lead/cycle times, workload allocation, and flow timestamps. Test count increased from 514 to 528 tests (27 suites).

### Wave 2: Server Actions & Authorization Layer (`src/actions/`)
- **Security Hardening (`cancelInvite`):**
  - Scoped invite deletion by project: `where: { id: inviteId, projectId }`. Cross-project deletion attempts now fail with Prisma `P2025`, preventing IDOR privilege escalation.
- **Pre-Transaction Validation (`approveProposal`):**
  - Validates `targetState` existence prior to opening database transaction, preventing transaction abort overhead.
- **Guard Standardization:**
  - Introduced clean `requireUserId`, `requireAdminSession`, and `assertNotProjectOwner` helper patterns.
- **Public API Contract Inviolability:**
  - All `.d.ts` declaration outputs remained byte-identical to pre-refactor state.

### Wave 3: Interactive Kanban & Task Detail UI (`src/components/`)
- `kanban-board.tsx`:
  - Replaced deprecated `useEffect` state resetting with official React 19 render-phase synchronization (`if (syncedStates !== initialStates)`), resolving ESLint `react-hooks/set-state-in-effect`.
  - Extracted `moveTaskAcrossColumns` and `findColumnId` to pure top-level helper functions.
- `task-detail-modal.tsx`:
  - Resolved race condition during rapid task navigation where stale network responses could overwrite newer task details.
  - Extracted `EditableTitle` component with self-contained local draft state.
  - Standardized tab button rendering via `DETAIL_TABS` array.

### Wave 4: Project Settings & Management Modals (`src/components/settings/`)
- `members-manager.tsx`, `states-manager.tsx`, `labels-manager.tsx`:
  - Added optimistic rename with automatic rollback on server error for state and label names.
  - Resolved `setTimeout` memory leak on "Copied!" link notification via proper `clearTimeout` cleanup.
  - Removed render-time `window.location` reads to ensure Next.js App Router hydration safety.
  - Handled browser clipboard permission rejections cleanly.

---

## 3 Targeted Hardening Packages (Post-Wave Optimization)

Following the 4 waves, 3 dedicated packages were identified, verified, and executed:

### Package 1: Backend Hardening, Security, Data Integrity & authz Consolidation
- Centralized `src/lib/authz.ts` providing standard server-only guards: `requireSession`, `requireUserId`, `requireMembership`, `requireAdmin`, `requireAdminSession`, `assertNotProjectOwner`.
- Refactored all 12 action files in `src/actions/` to use `@/lib/authz`, eliminating 200+ redundant boilerplate lines.
- Pre-transaction cross-project ID verification in `src/actions/task.ts` for states and assignees.
- Expiration check scoping (`expiresAt > new Date()`) in `src/actions/member.ts`.
- Removed erroneous active sprint check from `createSprint`; added draft requirement in `startSprint`.

### Package 2: UI, UX, Modal Interactions & Frontend Hardening
- Created `src/lib/use-task-navigation.ts` hook unifying `?task=` search param synchronization across `kanban-board.tsx`, `list-view-container.tsx`, and `backlog-page-container.tsx`.
- Modal Escape isolation in `EditableTitle`, `InlineSelectPopover`, and `task-relations.tsx` preventing unintentional closure of the parent task slide-over.
- Optimistic title rollback on update failure in `task-detail-modal.tsx`.
- Disabled delete action with tooltip when only a single state remains in `states-manager.tsx`.
- Converted ambiguous status dropdown in `edit-sprint-modal.tsx` to an informative read-only badge.

### Package 3: Performance, Concurrency & Polish
- Atomic concurrency guard in `completeSprint` via `updateMany({ where: { id: sprintId, status: "ACTIVE" } })`, eliminating race conditions and duplicate notification dispatch.
- Resilient notification dispatch wrapped in `try/catch` within `completeSprint`.
- Enforced invalid direct `COMPLETED` transitions in `updateSprint`.
- Render-phase prop synchronization in `ColorPicker` with 200ms input debounce and blur/unmount pending color flush.
- Extracted shared `InlineNameInput` (`src/components/settings/inline-name-input.tsx`), removing duplication across `states-manager.tsx` and `labels-manager.tsx`.

---

## Architectural Invariants Maintained
1. **Zero Public Signature Drift:** All server actions and pure domain logic retained identical parameter and return types.
2. **Deterministic Test Inviolability:** Existing test suites in `src/lib/__tests__/` were strictly untouched by Claude; Antigravity authored the new test suite.
3. **Database Stability:** Zero modifications to `prisma/schema.prisma` or migration files.
