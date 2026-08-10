-- Keys that let a pharmacy's own software write its stock listings.
--
-- Only the SHA-256 of a key is stored. The raw value is shown to the owner
-- once, at creation, and is unrecoverable afterwards — so this table
-- cannot be read as a list of working credentials, and a database dump is
-- not a set of write tokens for every pharmacy in the country.
CREATE TABLE "PharmacyApiKey" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyApiKey_pkey" PRIMARY KEY ("id")
);

-- The lookup every authenticated API request makes.
CREATE UNIQUE INDEX "PharmacyApiKey_tokenHash_key" ON "PharmacyApiKey"("tokenHash");

-- FK side, so listing a pharmacy's keys and cascading a deleted pharmacy
-- do not scan the table.
CREATE INDEX "PharmacyApiKey_pharmacyId_idx" ON "PharmacyApiKey"("pharmacyId");

ALTER TABLE "PharmacyApiKey" ADD CONSTRAINT "PharmacyApiKey_pharmacyId_fkey"
    FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase serves every public table over PostgREST with the anon key. This
-- one holds credentials, so an unprotected table would be the worst
-- possible thing to leave readable. No policies, and never FORCE — the app
-- connects as the owner and must not be locked out. See AGENTS.md.
ALTER TABLE "PharmacyApiKey" ENABLE ROW LEVEL SECURITY;

-- A fourth way stock can change. The owner's audit log answers "who
-- changed this and how", and "my POS did, using the key called Front
-- Counter" is a different answer from the other three.
--
-- Only added here, never used in this transaction — Postgres forbids
-- using a new enum value in the transaction that adds it.
ALTER TYPE "InventoryLogSource" ADD VALUE 'API';
