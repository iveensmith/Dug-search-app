-- Indexes for the query shapes that were doing full scans.
--
-- 1. Drug autocomplete. /api/drugs/search runs
--       WHERE "genericName" ILIKE '%q%' OR <any brand name> ILIKE '%q%'
--    on every keystroke. A leading wildcard cannot use a btree, so this was
--    reading the whole Drug table and running unnest() once per row. Both
--    sides of the OR need an index or the planner still has to look at
--    every row, hence two.
--
-- 2. Four foreign keys with no index on the referencing side. Postgres does
--    not create these automatically. Without them, deleting one Drug or one
--    User means a sequential scan of the referencing table to find the rows
--    to cascade, and any query filtering by those columns does the same.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- array_to_string is STABLE, not IMMUTABLE, so it cannot appear in an index
-- expression directly. This wrapper pins the behaviour we depend on.
-- The separator is a newline rather than a space so a search can never match
-- across two brand names: the old EXISTS/unnest form matched within a single
-- name, and a typed query cannot contain a newline.
CREATE OR REPLACE FUNCTION "drugBrandNamesText"(text[])
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$ SELECT array_to_string(COALESCE($1, ARRAY[]::text[]), E'\n') $$;

CREATE INDEX "Drug_genericName_trgm_idx"
  ON "Drug" USING gin ("genericName" gin_trgm_ops);

CREATE INDEX "Drug_brandNames_trgm_idx"
  ON "Drug" USING gin ("drugBrandNamesText"("brandNames") gin_trgm_ops);

-- Unindexed foreign keys
CREATE INDEX "SearchLog_drugId_idx" ON "SearchLog"("drugId");
CREATE INDEX "Reservation_drugId_idx" ON "Reservation"("drugId");
CREATE INDEX "PharmacyRating_userId_idx" ON "PharmacyRating"("userId");
CREATE INDEX "PrescriptionMessage_senderUserId_idx" ON "PrescriptionMessage"("senderUserId");
