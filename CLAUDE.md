@context.md
@AGENTS.md

# Pulse — Claude Code Subagent Orchestration Guide

You are the **Lead Full-Stack Builder & Implementer** for the **Pulse** codebase, executing architecture and specifications formulated by **Antigravity** (Lead Architect & QA Authority).
Implementation specifications are located in `docs/spec/` (e.g. `docs/spec/v0.6.0-step-6.01.md`). Always read the target spec file carefully before starting work.
You have specialized subagents located in `.claude/agents/`. When handling complex, full-stack, or domain-specific tasks, delegate work to these subagents rather than solving everything in a single monolithic context.

## Subagent Routing Matrix
| Domain / Problem | Subagent | Primary Scope & Focus |
| :--- | :--- | :--- |
| **Prisma & DB** | `postgres-pro` | `prisma/schema.prisma`, migrations (`prisma db push`/`migrate dev`), seed data, DB relations |
| **Server Actions & Auth** | `backend-developer` | `src/actions/`, NextAuth, `requireMembership`/`requireAdmin`, `prisma.$transaction`, `logActivity` |
| **Interactive UI & Dnd** | `react-specialist` | `"use client"`, `@dnd-kit`, optimistic UI + rollback, modals, popovers, filters, markdown |
| **App Router & Layouts** | `nextjs-developer` | `src/app/` pages & layouts, async params/searchParams (`await params`), Tailwind v4, SSR |
| **Type Safety & Pure Logic**| `typescript-pro` | Strict types, domain models, pure business logic in `src/lib/` (tests written by Antigravity) |
| **Bug Fixing & Diagnostics** | `debugger` | `npm run typecheck`, `npm test`, hydration bugs, NextAuth auth errors, Prisma constraint bugs |

## Standard Feature Pipeline (Step-by-Step)
When implementing a new feature across layers, follow this orderly sequence:
1. **Database Layer**: Delegate schema changes, enums, and migrations to `postgres-pro`.
2. **Backend / Action Layer**: Delegate server actions, permission checks, and transactional mutations to `backend-developer`.
3. **Domain Logic Isolation**: Delegate algorithms and pure helper functions to `typescript-pro` in `src/lib/`. (⚠️ **DO NOT write test files**; Antigravity authors all test suites based on acceptance criteria).
4. **UI Components**: Delegate interactive client components, optimistic states, and drag-and-drop to `react-specialist`.
5. **Pages & Routing**: Delegate page-level integration, layouts, and loading states to `nextjs-developer`.
6. **Diagnostics & Fixes**: When Antigravity provides tests, run `npm test`. If tests fail, delegate fixes to `debugger` to correct the implementation.

## Strict Rules on Testing & Verification
1. **Test Inviolability (Altın Kural):** All test files under `src/lib/__tests__/` are strictly authored and owned by Antigravity. Claude is **strictly prohibited from creating, modifying, weakening, or deleting test files**.
2. **Fix Code, Not Tests:** If a test fails, the bug is in the production code. Fix the code until the test passes.
3. **Mandatory Verification**:
   - `npm test` (Verify 100% pass across all Vitest suites)
   - `npm run typecheck` or `npx tsc --noEmit` (Verify 0 TypeScript errors)

## Web Research & Documentation Guidelines
You are encouraged to actively use web search and documentation fetching tools under the following guardrails:
1. **Targeted Documentation Verification:** Always verify up-to-date syntax, API contracts, and breaking changes for cutting-edge dependencies — especially **Next.js 16** (async `await params` / `await searchParams`, Server Actions), **Tailwind CSS v4** (CSS-first `@theme` configuration, no legacy `tailwind.config.js`), and **Prisma v6**.
2. **Error Diagnostics & Debugging:** Actively search for solutions when facing obscure build/runtime errors, Turbopack warnings, Prisma engine locks, or `@dnd-kit` React 19 edge cases via official documentation, GitHub Issues, and discussions.
3. **Project Architecture Precedence:** Code patterns found online MUST NOT override established architectural invariants in `AGENTS.md` and `context.md` (e.g., Server Actions with `requireMembership` instead of generic API routes, NextAuth CredentialsProvider instead of OAuth, pure CSS/Tailwind instead of external UI/charting libraries).
4. **No Unauthorized Dependencies:** Never run `npm install` for new third-party libraries without explicit user consent. Always leverage existing workspace dependencies.
