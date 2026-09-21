-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TASK_MENTIONED';
ALTER TYPE "NotificationType" ADD VALUE 'DUE_DATE_APPROACHING';

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "userId" TEXT NOT NULL,
    "notifyTaskAssigned" BOOLEAN NOT NULL DEFAULT true,
    "notifyCommentAdded" BOOLEAN NOT NULL DEFAULT true,
    "notifyMentioned" BOOLEAN NOT NULL DEFAULT true,
    "notifyDueDateApproaching" BOOLEAN NOT NULL DEFAULT true,
    "notifySprintClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
