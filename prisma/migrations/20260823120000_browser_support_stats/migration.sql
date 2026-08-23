-- Counts of visits by how much of the app the browser can actually run.
--
-- An iPhone 6 cannot run this app at all, and an iPhone 6s or 7 gets it
-- with the colours broken (BROWSERS.md has the measurements). Whether
-- that is worth doing anything about depends on how many real visitors
-- are on those phones, which nothing here was recording.
--
-- Aggregate by construction: one row per day per bucket, holding a
-- number. No address, no user agent, no session id, no user id — there is
-- no column here that could carry one. That matters more than usual for
-- an app whose visitors are looking up their own medicines.
CREATE TABLE "BrowserSupportStat" (
    "day"    TIMESTAMP(3) NOT NULL,
    "bucket" TEXT NOT NULL,
    "count"  INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BrowserSupportStat_pkey" PRIMARY KEY ("day", "bucket")
);

-- Supabase serves every public table over PostgREST with the anon key.
-- Nothing here is sensitive, but an open table is still an open write
-- endpoint. No policies, never FORCE — the app connects as the owner.
-- See AGENTS.md.
ALTER TABLE "BrowserSupportStat" ENABLE ROW LEVEL SECURITY;
