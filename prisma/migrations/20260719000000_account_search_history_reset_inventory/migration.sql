-- AlterTable
ALTER TABLE "PharmacyInventory" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SearchLog" ADD COLUMN     "state" "NigerianState",
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT;

-- CreateIndex
CREATE INDEX "SearchLog_userId_createdAt_idx" ON "SearchLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_state_createdAt_idx" ON "SearchLog"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

