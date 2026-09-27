-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SPRINT_UPDATED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemClock" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "mockTime" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemClock_pkey" PRIMARY KEY ("id")
);
