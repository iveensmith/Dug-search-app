-- A set-aside pack is held for two hours, not forever.
--
-- Only READY lapses. A PENDING request has nothing physically set aside,
-- so expiring it would take something from the patient and give the
-- counter nothing back — that one stays flagged as stale after 24h and
-- otherwise untouched, as it always was.
--
-- readyAt is the clock the hold runs from, set when the pharmacy sets the
-- pack aside. Nullable with no backfill: rows that reached READY before
-- this existed have no readyAt and therefore never lapse. Backfilling
-- from updatedAt would silently expire holds people were promised without
-- a deadline, which is the exact surprise the feature exists to prevent.
--
-- No index. The sweep is always already scoped to one patient or one
-- pharmacy, both of which are served by the existing composite indexes.

ALTER TYPE "ReservationStatus" ADD VALUE 'EXPIRED';

ALTER TABLE "Reservation" ADD COLUMN "readyAt" TIMESTAMP(3);
