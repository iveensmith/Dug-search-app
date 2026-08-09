-- How much of a drug a pharmacy has, in terms a patient can act on.
--
-- "In stock" is the same answer whether there is a month's supply or three
-- tablets left, and a patient needing a 28-day course cannot tell those
-- apart before travelling.
--
-- Not derived from PharmacyInventory."quantity": that column records a
-- number with no unit beside it, so 12 could be twelve boxes or twelve
-- tablets. The pharmacy states the band instead.
--
-- Nullable on purpose, with no backfill. Null means "in stock, amount not
-- stated", which is precisely what every existing row already meant —
-- guessing a band for rows nobody has looked at would put words in a
-- pharmacy's mouth about stock we know nothing about.

CREATE TYPE "StockLevel" AS ENUM ('PLENTY', 'LOW', 'LAST_FEW');

ALTER TABLE "PharmacyInventory" ADD COLUMN "stockLevel" "StockLevel";
