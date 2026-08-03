-- CreateTable
CREATE TABLE "PharmacyRating" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availability" INTEGER NOT NULL,
    "service" INTEGER NOT NULL,
    "pricing" INTEGER NOT NULL,
    "honesty" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyRating_pharmacyId_userId_key" ON "PharmacyRating"("pharmacyId", "userId");

-- CreateIndex
CREATE INDEX "PharmacyRating_pharmacyId_createdAt_idx" ON "PharmacyRating"("pharmacyId", "createdAt");

-- AddForeignKey
ALTER TABLE "PharmacyRating" ADD CONSTRAINT "PharmacyRating_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyRating" ADD CONSTRAINT "PharmacyRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
