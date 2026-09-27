-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'STANDUP_SUMMARY_PUBLISHED';
ALTER TYPE "NotificationType" ADD VALUE 'WEEKLY_DIGEST_PUBLISHED';

-- CreateTable
CREATE TABLE "DailyStandup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,
    "blockers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStandup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandupEntry" (
    "id" TEXT NOT NULL,
    "standupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yesterday" TEXT NOT NULL,
    "today" TEXT NOT NULL,
    "blockers" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandupEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyStandup_projectId_idx" ON "DailyStandup"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStandup_projectId_date_key" ON "DailyStandup"("projectId", "date");

-- CreateIndex
CREATE INDEX "StandupEntry_userId_idx" ON "StandupEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StandupEntry_standupId_userId_key" ON "StandupEntry"("standupId", "userId");

-- AddForeignKey
ALTER TABLE "DailyStandup" ADD CONSTRAINT "DailyStandup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupEntry" ADD CONSTRAINT "StandupEntry_standupId_fkey" FOREIGN KEY ("standupId") REFERENCES "DailyStandup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupEntry" ADD CONSTRAINT "StandupEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
