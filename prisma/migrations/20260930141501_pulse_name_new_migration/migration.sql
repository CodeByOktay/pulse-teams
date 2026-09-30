-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WORKLOAD_REBALANCE_PROPOSED';
ALTER TYPE "NotificationType" ADD VALUE 'SPRINT_OVERFLOW_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'SPRINT_RETRO_PUBLISHED';

-- DropIndex
DROP INDEX "task_embedding_cosine_idx";

-- AlterTable
ALTER TABLE "AgentProposal" ADD COLUMN     "suggestedAssigneeId" TEXT;

-- AlterTable
ALTER TABLE "SystemClock" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "checkpoint_migrations" (
    "v" INTEGER NOT NULL,

    CONSTRAINT "checkpoint_migrations_pkey" PRIMARY KEY ("v")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "type" TEXT,
    "checkpoint" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","checkpoint_id")
);

-- CreateTable
CREATE TABLE "checkpoint_blobs" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "blob" BYTEA,

    CONSTRAINT "checkpoint_blobs_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","channel","version")
);

-- CreateTable
CREATE TABLE "checkpoint_writes" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT,
    "blob" BYTEA NOT NULL,
    "task_path" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "checkpoint_writes_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","checkpoint_id","task_id","idx")
);

-- CreateIndex
CREATE INDEX "checkpoints_thread_id_idx" ON "checkpoints"("thread_id");

-- CreateIndex
CREATE INDEX "checkpoint_blobs_thread_id_idx" ON "checkpoint_blobs"("thread_id");

-- CreateIndex
CREATE INDEX "checkpoint_writes_thread_id_idx" ON "checkpoint_writes"("thread_id");

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_suggestedAssigneeId_fkey" FOREIGN KEY ("suggestedAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
