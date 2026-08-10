import { prisma } from './db'

/**
 * A fixed-window request counter, shared by anything that needs one.
 *
 * Lifted out of lib/loginThrottle, which had the only copy. The public API
 * needs the same thing for a different key space, and two implementations
 * of "how many requests in the last minute" is how they end up disagreeing
 * — one of them getting a bug fix the other does not.
 *
 * Counters live in Postgres for the reason loginThrottle documents: the
 * app runs on serverless functions, where an in-process Map is
 * per-instance, so a caller's allowance resets for free whenever the
 * platform starts a new one.
 */

export type Verdict = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/**
 * Counts this request against `key`'s window and says whether it may go on.
 *
 * One statement, so two requests arriving together cannot both read the
 * same count and both decide they are the last one allowed. The window is
 * fixed rather than sliding: at a boundary it will briefly allow up to
 * twice the limit, which is not worth a sorted set of timestamps for
 * either of the things using this.
 *
 * `key` is namespaced by the caller ("ip:1.2.3.4", "apikey:<id>") because
 * every counter shares one table.
 */
export async function consumeWindow(key: string, max: number, windowMs: number): Promise<Verdict> {
  const cutoff = new Date(Date.now() - windowMs)

  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "AuthThrottle" ("key", "count", "windowStart", "updatedAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "AuthThrottle"."windowStart" < ${cutoff} THEN 1
        ELSE "AuthThrottle"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "AuthThrottle"."windowStart" < ${cutoff} THEN CURRENT_TIMESTAMP
        ELSE "AuthThrottle"."windowStart"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count", "windowStart"
  `

  const row = rows[0]
  if (!row || row.count <= max) return { allowed: true }

  const resetsAt = row.windowStart.getTime() + windowMs
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)),
  }
}
