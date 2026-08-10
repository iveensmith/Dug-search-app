-- Proof that the email on an account is really the account holder's.
--
-- Three nullable columns and no backfill. Every account that existed
-- before this is therefore unverified, which is the honest state: nobody
-- has ever proved those addresses, and marking them verified would be
-- recording a check that never happened.
--
-- Being unverified deliberately blocks nothing — see lib/emailVerification
-- for the reasoning. The columns exist so the app can ask, and so a future
-- decision to require it has something to require.
--
-- The token column mirrors passwordResetTokenHash exactly: what is stored
-- is the SHA-256 of the emailed token, so reading this table gives an
-- attacker nothing they can put in a URL.

ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifyTokenHash" TEXT,
  ADD COLUMN "emailVerifyExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_emailVerifyTokenHash_key" ON "User"("emailVerifyTokenHash");
