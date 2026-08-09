-- Whether a medicine needs a prescription.
--
-- The app can already tell someone six pharmacies hold a drug. If that
-- drug is prescription-only it will still send them on a journey that ends
-- at a counter they cannot buy from — right about the stock, wrong about
-- the trip. This is the column that lets the search say so first.
--
-- Nullable, with no backfill, and no default. Most of the catalogue is
-- unclassified and stays that way until a person looks at the row. Null is
-- rendered as silence, never as "no prescription needed": guessing from a
-- generic name would put a legal claim about a medicine in the app's mouth
-- on the strength of string matching.
--
-- No index. Nothing filters or sorts on this yet — it is read alongside a
-- drug already located by id or by the trigram name search.

CREATE TYPE "DispensingClass" AS ENUM ('POM', 'PHARMACY_ONLY', 'OTC');

ALTER TABLE "Drug" ADD COLUMN "dispensing" "DispensingClass";
