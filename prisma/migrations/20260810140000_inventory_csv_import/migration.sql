-- Stock can now arrive from a spreadsheet as well as the dashboard and
-- WhatsApp. An owner reading their own audit log needs to be able to tell
-- the three apart — "who changed this and how" is the question that log
-- exists to answer, and "a CSV I uploaded on Tuesday" is a different
-- answer from "someone with a trusted phone number".
--
-- ALTER TYPE ... ADD VALUE is transactional on PG12+, so this is safe
-- inside the transaction Prisma wraps each migration in (same reasoning as
-- 20260809140000_reservation_hold_expiry).
ALTER TYPE "InventoryLogSource" ADD VALUE 'CSV';

-- One log line per import rather than one per row: a 200-row file would
-- otherwise bury every other entry in the owner's history.
ALTER TYPE "InventoryAction" ADD VALUE 'IMPORTED';
