-- Medicines a patient wants to find again.
--
-- Most searching here is repeat business: somebody on a chronic
-- prescription looks for the same drug every month, and retyping it is
-- the kind of small friction that quietly ends a habit.
--
-- The drug, not the search. Where a patient is changes — they travel,
-- they move — and pinning a saved item to an LGA would make it wrong the
-- first time they used it somewhere else.
CREATE TABLE "SavedDrug" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedDrug_pkey" PRIMARY KEY ("id")
);

-- Saving twice is the same as saving once.
CREATE UNIQUE INDEX "SavedDrug_userId_drugId_key" ON "SavedDrug"("userId", "drugId");

-- The list query, newest first.
CREATE INDEX "SavedDrug_userId_createdAt_idx" ON "SavedDrug"("userId", "createdAt");

ALTER TABLE "SavedDrug" ADD CONSTRAINT "SavedDrug_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedDrug" ADD CONSTRAINT "SavedDrug_drugId_fkey"
    FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase serves every public table over PostgREST with the anon key.
-- What medicines a named person takes is about as sensitive as this app
-- holds. No policies, never FORCE — the app connects as the owner. See
-- AGENTS.md.
ALTER TABLE "SavedDrug" ENABLE ROW LEVEL SECURITY;
