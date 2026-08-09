-- Stock updates over WhatsApp, from the people actually at the counter.
--
-- Three tables, one job each:
--
-- PharmacyStaff   which phone numbers may speak for which shop. Not Users:
--                 counter staff never sign in and see no patient data, so
--                 an account would be a liability rather than a login. The
--                 number is the whole credential, which is exactly why the
--                 owner adds it and the owner revokes it, and why it is
--                 globally unique — an inbound message carries nothing but
--                 a phone number, so one that mapped to two shops would
--                 leave the update with no shelf to belong to.
--
-- InventoryLog    who changed a listing, when, and through what. Stock
--                 claims are the one thing this app asks patients to
--                 trust; a channel where a text message flips a shelf to
--                 "out" has to leave a trail the owner can read back.
--
-- WhatsappInbound every message id already acted on. Meta retries a
--                 webhook until it gets a 200, and a retried "/out
--                 amoxicillin" must not mark it out twice.
--
-- Nothing here touches PharmacyInventory. WhatsApp writes the same
-- columns the dashboard does — inStock, quantity, and updatedAt as the
-- confirmation stamp — so the two channels cannot drift into disagreeing
-- about what a shelf holds.

CREATE TYPE "InventoryAction" AS ENUM ('CONFIRMED_ALL', 'MARKED_IN_STOCK', 'MARKED_OUT_OF_STOCK', 'QUANTITY_SET');
CREATE TYPE "InventoryLogSource" AS ENUM ('WEB', 'WHATSAPP');

CREATE TABLE "PharmacyStaff" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "displayName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacyStaff_phone_key" ON "PharmacyStaff"("phone");
CREATE INDEX "PharmacyStaff_pharmacyId_idx" ON "PharmacyStaff"("pharmacyId");

ALTER TABLE "PharmacyStaff"
  ADD CONSTRAINT "PharmacyStaff_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "staffId" TEXT,
    "inventoryId" TEXT,
    "action" "InventoryAction" NOT NULL,
    "source" "InventoryLogSource" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryLog_pharmacyId_createdAt_idx" ON "InventoryLog"("pharmacyId", "createdAt");

ALTER TABLE "InventoryLog"
  ADD CONSTRAINT "InventoryLog_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL rather than CASCADE: revoking a number must not delete the
-- record of what it did while it was trusted.
ALTER TABLE "InventoryLog"
  ADD CONSTRAINT "InventoryLog_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "PharmacyStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WhatsappInbound" (
    "messageId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappInbound_pkey" PRIMARY KEY ("messageId")
);

CREATE INDEX "WhatsappInbound_processedAt_idx" ON "WhatsappInbound"("processedAt");
