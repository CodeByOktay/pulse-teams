-- CreateEnum
CREATE TYPE "ProgressRequestStatus" AS ENUM ('PENDING', 'RESPONDED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProgressRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "requestedById" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'manual',
    "status" "ProgressRequestStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressResponse" (
    "id" TEXT NOT NULL,
    "progressRequestId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgressRequest_taskId_idx" ON "ProgressRequest"("taskId");

-- CreateIndex
CREATE INDEX "ProgressRequest_recipientId_status_idx" ON "ProgressRequest"("recipientId", "status");

-- CreateIndex
CREATE INDEX "ProgressRequest_projectId_idx" ON "ProgressRequest"("projectId");

-- CreateIndex
CREATE INDEX "ProgressResponse_progressRequestId_idx" ON "ProgressResponse"("progressRequestId");

-- CreateIndex
CREATE INDEX "ProgressResponse_responderId_idx" ON "ProgressResponse"("responderId");

-- AddForeignKey
ALTER TABLE "ProgressRequest" ADD CONSTRAINT "ProgressRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRequest" ADD CONSTRAINT "ProgressRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRequest" ADD CONSTRAINT "ProgressRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRequest" ADD CONSTRAINT "ProgressRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressResponse" ADD CONSTRAINT "ProgressResponse_progressRequestId_fkey" FOREIGN KEY ("progressRequestId") REFERENCES "ProgressRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressResponse" ADD CONSTRAINT "ProgressResponse_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
