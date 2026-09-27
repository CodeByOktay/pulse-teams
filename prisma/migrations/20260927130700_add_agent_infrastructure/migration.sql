-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lockedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "pmUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainEvent_status_createdAt_idx" ON "DomainEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEvent_status_lockedAt_idx" ON "DomainEvent"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "AgentRun_projectId_idx" ON "AgentRun"("projectId");

-- CreateIndex
CREATE INDEX "AgentRun_agentKey_status_idx" ON "AgentRun"("agentKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_agentKey_projectId_scheduledFor_key" ON "AgentRun"("agentKey", "projectId", "scheduledFor");

-- CreateIndex
CREATE INDEX "AgentSettings_projectId_idx" ON "AgentSettings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSettings_projectId_agentKey_key" ON "AgentSettings"("projectId", "agentKey");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSettings" ADD CONSTRAINT "AgentSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSettings" ADD CONSTRAINT "AgentSettings_pmUserId_fkey" FOREIGN KEY ("pmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
