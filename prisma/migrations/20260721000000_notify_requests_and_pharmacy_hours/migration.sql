-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "closesAt" TEXT,
ADD COLUMN     "open24h" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opensAt" TEXT;

-- CreateTable
CREATE TABLE "StockNotifyRequest" (
    "id" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "state" "NigerianState" NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "StockNotifyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockNotifyRequest_drugId_state_notifiedAt_idx" ON "StockNotifyRequest"("drugId", "state", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockNotifyRequest_drugId_state_email_key" ON "StockNotifyRequest"("drugId", "state", "email");

-- AddForeignKey
ALTER TABLE "StockNotifyRequest" ADD CONSTRAINT "StockNotifyRequest_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

