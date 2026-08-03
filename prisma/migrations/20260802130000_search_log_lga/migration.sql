-- AlterTable
ALTER TABLE "SearchLog" ADD COLUMN "lga" TEXT;

-- CreateIndex
CREATE INDEX "SearchLog_state_lga_createdAt_idx" ON "SearchLog"("state", "lga", "createdAt");
