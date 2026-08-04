-- AlterTable
ALTER TABLE "Drug" ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "Drug_category_idx" ON "Drug"("category");
