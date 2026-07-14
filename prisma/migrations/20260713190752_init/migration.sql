-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'PHARMACY_OWNER', 'PHARMACIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DrugForm" AS ENUM ('TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM', 'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'SUPPOSITORY', 'OTHER');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'CLAIMED', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drug" (
    "id" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "brandNames" TEXT[],
    "strength" TEXT NOT NULL,
    "form" "DrugForm" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT NOT NULL,
    "pcnLicenseNumber" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyInventory" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "drugId" TEXT,
    "queryText" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "hadResults" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionUpload" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "pharmacistUserId" TEXT,
    "imageKey" TEXT NOT NULL,
    "patientNote" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionMessage" (
    "id" TEXT NOT NULL,
    "prescriptionUploadId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "PrescriptionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Drug_genericName_strength_form_key" ON "Drug"("genericName", "strength", "form");

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_pcnLicenseNumber_key" ON "Pharmacy"("pcnLicenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_ownerUserId_key" ON "Pharmacy"("ownerUserId");

-- CreateIndex
CREATE INDEX "Pharmacy_verificationStatus_idx" ON "Pharmacy"("verificationStatus");

-- CreateIndex
CREATE INDEX "Pharmacy_latitude_longitude_idx" ON "Pharmacy"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "PharmacyInventory_drugId_inStock_idx" ON "PharmacyInventory"("drugId", "inStock");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyInventory_pharmacyId_drugId_key" ON "PharmacyInventory"("pharmacyId", "drugId");

-- CreateIndex
CREATE INDEX "SearchLog_hadResults_createdAt_idx" ON "SearchLog"("hadResults", "createdAt");

-- CreateIndex
CREATE INDEX "PrescriptionUpload_status_createdAt_idx" ON "PrescriptionUpload"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrescriptionUpload_patientUserId_idx" ON "PrescriptionUpload"("patientUserId");

-- CreateIndex
CREATE INDEX "PrescriptionUpload_pharmacistUserId_idx" ON "PrescriptionUpload"("pharmacistUserId");

-- CreateIndex
CREATE INDEX "PrescriptionMessage_prescriptionUploadId_createdAt_idx" ON "PrescriptionMessage"("prescriptionUploadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Pharmacy" ADD CONSTRAINT "Pharmacy_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyInventory" ADD CONSTRAINT "PharmacyInventory_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyInventory" ADD CONSTRAINT "PharmacyInventory_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionUpload" ADD CONSTRAINT "PrescriptionUpload_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionUpload" ADD CONSTRAINT "PrescriptionUpload_pharmacistUserId_fkey" FOREIGN KEY ("pharmacistUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionMessage" ADD CONSTRAINT "PrescriptionMessage_prescriptionUploadId_fkey" FOREIGN KEY ("prescriptionUploadId") REFERENCES "PrescriptionUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionMessage" ADD CONSTRAINT "PrescriptionMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
