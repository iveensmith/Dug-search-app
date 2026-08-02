-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN "lga" TEXT;

-- CreateIndex
CREATE INDEX "Pharmacy_state_lga_idx" ON "Pharmacy"("state", "lga");
