-- Spoken notes on a prescription query.
--
-- Typing a symptom in English is a real barrier. The words for what is
-- wrong often come first in Pidgin, Ibibio, Hausa or Yoruba, and a patient
-- who could describe it in thirty seconds of speech writes two flat lines
-- instead — or gives up and takes the medicine without asking.
--
-- Both columns are nullable with no backfill: every existing query was
-- text and a photo, and stays exactly that.
--
-- audioDurationSec is whatever the browser reported, clamped. It is a
-- label on a play button and nothing else — no limit and no billing reads
-- it, because the server cannot verify a duration without a decoder it
-- does not carry. Bytes are what the server actually enforces.

ALTER TABLE "PrescriptionUpload"
  ADD COLUMN "audioKey" TEXT,
  ADD COLUMN "audioDurationSec" INTEGER;

ALTER TABLE "PrescriptionMessage"
  ADD COLUMN "audioKey" TEXT,
  ADD COLUMN "audioDurationSec" INTEGER;

-- A message used to be text by definition. It can now be a voice note
-- instead, so the NOT NULL has to go.
ALTER TABLE "PrescriptionMessage" ALTER COLUMN "messageText" DROP NOT NULL;

-- But it must never be neither. Without this, a bug in any future caller
-- could put an empty bubble in a medical conversation — something that
-- looks like the pharmacist said nothing rather than like a bug.
--
-- NOT VALID, then VALIDATE: the validate pass takes only a SHARE UPDATE
-- EXCLUSIVE lock, so adding this cannot block writes to a live table
-- while it scans. Existing rows all have text, so it will pass.
ALTER TABLE "PrescriptionMessage"
  ADD CONSTRAINT "PrescriptionMessage_has_content"
  CHECK ("messageText" IS NOT NULL OR "audioKey" IS NOT NULL) NOT VALID;

ALTER TABLE "PrescriptionMessage" VALIDATE CONSTRAINT "PrescriptionMessage_has_content";
