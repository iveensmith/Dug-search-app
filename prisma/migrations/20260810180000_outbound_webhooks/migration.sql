-- Telling a pharmacy's own software that a patient is coming.
--
-- The stock API is the shop talking to us. This is the other direction,
-- and the only event worth the machinery: a reservation is a person who
-- has left the house expecting a medicine to be waiting.
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    -- Plaintext, unlike an API key: signing needs the original value, so
    -- there is no hash we could sign with. It is a signing key rather
    -- than an access credential — holding it lets somebody forge events
    -- to that pharmacy, and grants nothing against this app.
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastOkAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- One endpoint per pharmacy. More than one is a feature nobody has asked
-- for, and the unique index is what keeps that decision honest.
CREATE UNIQUE INDEX "WebhookEndpoint_pharmacyId_key" ON "WebhookEndpoint"("pharmacyId");

ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_pharmacyId_fkey"
    FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every event is written before it is sent. A row that exists but was
-- never delivered can be retried; a send that was never recorded is gone.
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    -- Stored exactly as signed. Re-serialising JSON reorders keys and
    -- breaks the receiver's signature check.
    "payload" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- The drain query: everything undelivered, not yet given up on, and due.
CREATE INDEX "WebhookDelivery_deliveredAt_failedAt_nextAttemptAt_idx"
    ON "WebhookDelivery"("deliveredAt", "failedAt", "nextAttemptAt");

ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey"
    FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase serves every public table over PostgREST with the anon key.
-- WebhookEndpoint holds signing secrets and WebhookDelivery holds patient
-- names and phone numbers in its payloads, so both would be the worst
-- kind of table to leave readable. No policies, never FORCE — the app
-- connects as the owner. See AGENTS.md.
ALTER TABLE "WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
