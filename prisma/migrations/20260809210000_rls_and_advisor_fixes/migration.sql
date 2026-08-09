-- Close the Supabase advisor's real findings.
--
-- Three separate things, in order of how much they matter.
--
-- 1. ROW LEVEL SECURITY
--
-- Supabase exposes every table in `public` over PostgREST, reachable with
-- the project's anon key. That key is public by design — it is meant to
-- ship inside client apps — so any table there with RLS off is readable
-- and writable by anyone who obtains it. On this schema that would mean
-- password hashes in "User", prescription threads, patients' phone
-- numbers and the staff numbers that authorise WhatsApp stock updates.
--
-- This app never uses PostgREST. It reaches Postgres through Prisma on
-- the direct connection, as the role that owns these tables — and a table
-- owner bypasses RLS. So enabling RLS with no policies denies anon and
-- authenticated everything while changing nothing for the app. The
-- tables that already had it enabled are the proof: they were switched on
-- by hand in the dashboard some time ago and the app has run on them ever
-- since.
--
-- Deliberately NOT "FORCE ROW LEVEL SECURITY": forcing applies RLS to the
-- owner too, and with no policies that would lock the application out of
-- its own database.
--
-- Done as a loop rather than a list because the list is what drifted in
-- the first place — every table created by a migration after somebody
-- clicked through the dashboard was silently left open.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 2. A FOREIGN KEY WITH NO INDEX
--
-- InventoryLog.staffId. Revoking a staff number sets it null across every
-- row that number ever touched (ON DELETE SET NULL), and without this
-- that is a sequential scan of the whole audit table. Same reasoning as
-- the FK indexes added in 20260807090000.

CREATE INDEX "InventoryLog_staffId_idx" ON "InventoryLog"("staffId");

-- 3. A FUNCTION WITH A MUTABLE SEARCH PATH
--
-- drugBrandNamesText resolves its calls through whatever search_path the
-- caller happens to have. Pinning it empty means the body can only reach
-- pg_catalog, which is where array_to_string and COALESCE live — so
-- nothing can be shadowed by an object planted in an earlier schema.
--
-- Safe for the GIN index built on this function: the body and volatility
-- are untouched, and indexes reference the function by OID.

ALTER FUNCTION "drugBrandNamesText"(text[]) SET search_path = '';
