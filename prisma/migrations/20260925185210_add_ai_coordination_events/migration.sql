-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'TASK_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_UNBLOCKED';
ALTER TYPE "ActivityType" ADD VALUE 'PROGRESS_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE 'PROGRESS_RESPONDED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_SUGGESTION_APPLIED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_SUGGESTION_REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TASK_UNBLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'PROGRESS_REQUESTED';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "isAiGenerated" BOOLEAN NOT NULL DEFAULT false;
