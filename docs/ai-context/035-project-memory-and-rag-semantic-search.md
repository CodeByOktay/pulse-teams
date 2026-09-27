# Pulse — Project Memory & RAG Semantic Search Architecture (ADR-035)

## Overview
Step 6.07 (`v0.6.6`) equips Pulse with enterprise Project Memory and Semantic Search (RAG) capabilities. Traditional text-based search is elevated into a hybrid ranking engine powered by PostgreSQL's `pgvector` extension. Tasks are automatically converted to 1536-dimensional vector embeddings, cached via SHA-256 content hashes to avoid redundant LLM calls, and searched using cosine distance (`<=>`) backed by an `ivfflat` index.

- **Milestone:** Phase 6, Step 6.07 (`v0.6.6` — Project Memory & RAG Semantic Search)
- **ADR Reference:** [`ADR-035: Proje Hafızası ve pgvector Tabanlı Semantik Arama Mimarisi`](../wiki/ADR-035-proje-hafizasi-ve-rag-semantik-arama-pgvector.md)
- **Phase 6 Scope:** Steps 6.00–6.08 (Complete 10-Agent Proactive System: Infrastructure + Agents 000–009 + RAG Semantic Search + Hardening)
- **Current Tests:** 807 passing (724 Vitest + 83 Pytest, 100% passing across 38 suites)

---

## Key Architectural Decisions

### 1. Unified Relational Vector Storage (`pgvector`)
- Rather than introducing an external vector DB (e.g. Pinecone, Qdrant), PostgreSQL 16 is upgraded to `pgvector/pgvector:pg16` in `docker-compose.yml`.
- Vector embeddings live in a dedicated `TaskEmbedding` table joined directly with `Task`.
- Cascading deletion (`onDelete: Cascade`) and project member access control (`EXISTS (SELECT 1 FROM ProjectMember ...)`) are executed in a single atomic SQL query.

### 2. TaskEmbedding Schema & Indexing
- **Table:** `TaskEmbedding`
  - `id`: `TEXT PRIMARY KEY` (CUID)
  - `taskId`: `TEXT UNIQUE REFERENCES Task(id) ON DELETE CASCADE`
  - `embedding`: `vector(1536)` (OpenAI compatible dimension; unsupported Prisma field)
  - `contentHash`: `TEXT` (SHA-256 hex digest of the formatted text)
  - `updatedAt`: `TIMESTAMP(3)`
- **Index:** `CREATE INDEX task_embedding_cosine_idx ON "TaskEmbedding" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);` for high-performance approximate nearest neighbor (ANN) lookups.

### 3. Idempotent Embedding Pipeline & Content Hashing
- **Text Standard:** `buildTaskEmbeddingText` formats tasks as `"[PRJ-12] Title\n\nDescription"` (omits description when empty, trims whitespace).
- **Change Detection:** `computeContentHash` calculates SHA-256. `shouldRegenerateEmbedding` compares with the existing stored hash; if title and description have not changed, expensive AI embedding API calls are bypassed entirely.
- **Asynchronous Service:** `upsertTaskEmbedding(taskId)` runs outside the client transaction (non-blocking). Failures are caught and logged as warnings, never throwing or interrupting core task CRUD operations.

### 4. Provider-Agnostic Embeddings Client (`src/lib/ai/embeddings.ts`)
- Configured via environment variables:
  - `AI_EMBEDDING_ENDPOINT`: Embeddings API URL (e.g. `https://api.openai.com/v1/embeddings` or local Ollama).
  - `AI_EMBEDDING_MODEL`: Target model (e.g. `text-embedding-3-small`).
  - Shares auth philosophy with existing LLM client (`AI_API_KEY`, `AI_AUTH_HEADER`, `AI_AUTH_SCHEME`, `AI_TIMEOUT_MS`).
- **Resilience Pattern:** Returns `null` if unconfigured, if network fails, or if non-2xx status is received. Never throws runtime exceptions to callers.

### 5. Pure Domain Mathematics (`src/lib/semantic-search.ts`)
- `cosineSimilarity(a, b)`: Pure vector cosine calculation with strict zero-norm and dimension-mismatch guards.
- `toVectorLiteral(embedding)`: Formats numbers into SQL string literals (`"[0.1,0.2,...]"`).
- `clampSimilarity(score)`: Clamps floating-point cosine distance values to `[0, 1]`.
- `filterBySimilarityThreshold(items, threshold = 0.7)`: Filters candidates meeting the similarity threshold.
- `mergeHybridResults(textResults, vectorResults, threshold = 0.7)`: Deduplicates and blends vector matches (sorted by similarity descending) followed by conventional text matches, preserving original ordering.

### 6. User Experience & Server Actions
- **Global Search (`src/actions/search.ts`):** `globalSearch` generates query embeddings and performs hybrid ranking merging text matches and vector matches with project access boundaries. If vector search fails or is unconfigured, it gracefully falls back to text search.
- **Similar Tasks (`src/actions/semantic-search.ts` & `SimilarTasks` UI):** In the task detail modal, tasks with ≥70% similarity from the same project are surfaced to detect duplicates and related efforts.

---

## Verification & Test Coverage
- **Vitest Suite:** `src/lib/__tests__/semantic-search.test.ts` (55 tests) covering text formatting, SHA-256 hashing, cosine similarity edge cases, vector literals, similarity clamping, threshold filtering, hybrid merging, config resolution, and API mocks.
- **Total Test Base:** 724 Vitest tests + 83 Pytest tests = 807 tests passing at 100%. Zero TypeScript compilation errors (`tsc --noEmit`), clean Next.js Turbopack production build.
