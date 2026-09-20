-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('BLOCKS', 'RELATES_TO', 'DUPLICATES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'TASK_RELATION_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_RELATION_REMOVED';

-- CreateTable
CREATE TABLE "TaskRelation" (
    "id" TEXT NOT NULL,
    "sourceTaskId" TEXT NOT NULL,
    "targetTaskId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskRelation_sourceTaskId_idx" ON "TaskRelation"("sourceTaskId");

-- CreateIndex
CREATE INDEX "TaskRelation_targetTaskId_idx" ON "TaskRelation"("targetTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskRelation_sourceTaskId_targetTaskId_type_key" ON "TaskRelation"("sourceTaskId", "targetTaskId", "type");

-- AddForeignKey
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_targetTaskId_fkey" FOREIGN KEY ("targetTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
