CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "TaskEmbedding" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "embedding" vector(1536),
    "contentHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskEmbedding_taskId_key" ON "TaskEmbedding"("taskId");
CREATE INDEX "TaskEmbedding_taskId_idx" ON "TaskEmbedding"("taskId");
ALTER TABLE "TaskEmbedding" ADD CONSTRAINT "TaskEmbedding_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "task_embedding_cosine_idx" ON "TaskEmbedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
