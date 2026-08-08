-- Counters behind the sign-in throttle: per-IP request rate, and per-account
-- consecutive failures with the lockout and the progressive delay between
-- attempts.
--
-- This lives in Postgres rather than in process memory because the app is
-- deployed to serverless functions (see DEPLOY.md). An in-process counter is
-- per-instance: the platform starts instances freely, so an attacker's
-- allowance resets for free and an account "locked" on one instance is still
-- open on every other one. The database is the only state all instances
-- already share.
--
-- `key` is `ip:<address>` or `account:<sha256 hex>` — never a raw email, so
-- this table cannot be read as a list of who has an account here.

CREATE TABLE "AuthThrottle" (
  "key"           TEXT         NOT NULL,
  "count"         INTEGER      NOT NULL DEFAULT 0,
  "windowStart"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil"   TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "notifiedAt"    TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

-- Rows outlive their usefulness by design — a counter has to survive the
-- window it is counting. Pruning walks by last touch, so it needs its own
-- index or every prune is a sequential scan of the whole table.
CREATE INDEX "AuthThrottle_updatedAt_idx" ON "AuthThrottle" ("updatedAt");
