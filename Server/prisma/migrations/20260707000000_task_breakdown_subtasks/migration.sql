-- FOLLO ENGINE — contractor task breakdown, subtasks & quoting
-- Adds a subtask hierarchy under Task plus a breakdown-approval lifecycle so an
-- awarded contractor can price and schedule the work, PM approves it, and the
-- quote/dates roll up into the project budget and the parent task's timeline.

-- CreateEnum
CREATE TYPE "BreakdownStatus" AS ENUM ('NONE', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable — breakdown lifecycle on Task
ALTER TABLE "Task"
    ADD COLUMN "breakdownStatus"          "BreakdownStatus" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "breakdownSubmittedAt"     TIMESTAMP(3),
    ADD COLUMN "breakdownSubmittedById"   TEXT,
    ADD COLUMN "breakdownApprovedAt"      TIMESTAMP(3),
    ADD COLUMN "breakdownApprovedById"    TEXT,
    ADD COLUMN "breakdownRejectedAt"      TIMESTAMP(3),
    ADD COLUMN "breakdownRejectionReason" TEXT;

-- CreateTable
CREATE TABLE "Subtask" (
    "id"               TEXT NOT NULL,
    "taskId"           TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate"   TIMESTAMP(3),
    "quotedCost"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actualCost"       DECIMAL(12,2),
    "completionWeight" INTEGER NOT NULL DEFAULT 1,
    "isComplete"       BOOLEAN NOT NULL DEFAULT false,
    "completedAt"      TIMESTAMP(3),
    "createdById"      TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubtaskLineItem" (
    "id"        TEXT NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "quantity"  DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitCost"  DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubtaskLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subtask_taskId_idx" ON "Subtask"("taskId");

-- CreateIndex
CREATE INDEX "Subtask_taskId_sortOrder_idx" ON "Subtask"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "Subtask_createdById_idx" ON "Subtask"("createdById");

-- CreateIndex
CREATE INDEX "SubtaskLineItem_subtaskId_idx" ON "SubtaskLineItem"("subtaskId");

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtaskLineItem" ADD CONSTRAINT "SubtaskLineItem_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "Subtask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
