-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'STALE');

-- CreateTable
CREATE TABLE "AgentProposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "progressResponseId" TEXT,
    "summary" TEXT NOT NULL,
    "suggestedStateId" TEXT,
    "suggestedGroup" "StateGroup",
    "blockerDetected" BOOLEAN NOT NULL DEFAULT false,
    "blockerDetails" TEXT,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentProposal_taskId_status_idx" ON "AgentProposal"("taskId", "status");

-- CreateIndex
CREATE INDEX "AgentProposal_projectId_idx" ON "AgentProposal"("projectId");

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_progressResponseId_fkey" FOREIGN KEY ("progressResponseId") REFERENCES "ProgressResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_suggestedStateId_fkey" FOREIGN KEY ("suggestedStateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
