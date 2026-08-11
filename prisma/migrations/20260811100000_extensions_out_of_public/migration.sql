-- Moves pg_trgm out of the `public` schema.
--
-- Supabase's Security Advisor flags any extension installed in `public`.
-- The concern is namespace shadowing: `public` is on everyone's search_path
-- by default, so a function or operator planted there can be resolved ahead
-- of the one a query meant to call. An extension's objects sitting in the
-- same namespace as application tables is the condition that makes that
-- possible.
--
-- This is safe for this app specifically, which is worth stating because it
-- is not safe for every app. pg_trgm is used here in exactly one way: three
-- GIN indexes declared with `gin_trgm_ops`. Nothing calls similarity(), the
-- `%` operator, or `<->` in SQL — the searches use ILIKE, which is a
-- built-in pg_catalog operator that the trigram indexes accelerate through
-- the operator class. An index scan resolves its opclass by OID, not by
-- search_path, so the existing indexes keep working after the move and no
-- reindex is needed.
--
-- An app that did call similarity() would need `extensions` on its
-- search_path, or those calls schema-qualified, before this migration.

CREATE SCHEMA IF NOT EXISTS extensions;

-- Guarded so this is a no-op on a database where the extension is already
-- somewhere else — a Supabase project created later may install it into
-- `extensions` from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END
$$;
