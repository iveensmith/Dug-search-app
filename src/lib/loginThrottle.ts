/**
 * Sign-in throttling: a per-IP request rate, and a per-account lockout
 * with a growing delay between attempts.
 *
 * Two different jobs, deliberately kept apart:
 *
 *  - The IP limit is about volume. It stops one machine walking a
 *    password list, and it answers 429 because that is what it is —
 *    nothing about it depends on whether the account exists.
 *
 *  - The account gate is about one account being attacked, possibly from
 *    many machines. It answers with exactly the same 401 as a wrong
 *    password, because saying "this account is locked" tells an attacker
 *    they have found a real account and that their guesses are landing.
 *
 * Counters live in Postgres. The app is deployed to serverless functions
 * (DEPLOY.md), where an in-process Map is per-instance: the platform
 * starts instances freely, so an attacker's allowance resets for free and
 * an account locked on one instance stays open on every other one. Swap
 * the store by replacing this file — the routes only see the exported
 * functions.
 */

import crypto from 'crypto'
import { prisma } from '@/lib/db'

/* ----------------------------------------------------------------- policy */

/** Requests one address may make to sign-in per window, of any outcome. */
export const IP_MAX_REQUESTS = 10
export const IP_WINDOW_MS = 60 * 1000

/** Consecutive failures before the account stops answering. */
export const MAX_FAILURES = 5
export const LOCKOUT_MS = 15 * 60 * 1000

/**
 * Wait imposed after each failure, by failure number. Short enough that a
 * person mistyping their password twice barely notices, steep enough that
 * an automated run costs more than it gains.
 */
const PROGRESSIVE_DELAY_MS = [0, 0, 1_000, 3_000, 8_000]

function delayAfter(failures: number): number {
  return PROGRESSIVE_DELAY_MS[Math.min(failures, PROGRESSIVE_DELAY_MS.length - 1)]
}

/* -------------------------------------------------------------------- keys */

/**
 * The client address, from the proxy headers the host sets.
 *
 * These are client-supplied and forgeable in principle; on Vercel the
 * platform overwrites x-forwarded-for with the real peer, which is what
 * makes it usable here. On a host that does not, the IP limit degrades to
 * a shared bucket — the account gate below does not depend on it.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
  return forwarded || req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Keyed by identifier rather than user id, so attempts against an address
 * with no account are counted too — otherwise "this one is not being
 * throttled" is itself an answer about which addresses are registered.
 *
 * Hashed so the table never becomes a list of who has an account here.
 */
export function accountKey(identifier: string, portal: string): string {
  const normalised = identifier.trim().toLowerCase()
  const digest = crypto.createHash('sha256').update(`${portal}:${normalised}`).digest('hex')
  return `account:${digest}`
}

/* --------------------------------------------------------------- IP limit */

export type IpVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/**
 * Counts this request against the address's window and says whether it may
 * proceed.
 *
 * One statement, so two requests arriving together cannot both read the
 * same count and both decide they are the tenth. The window is fixed
 * rather than sliding: at a boundary it will briefly allow up to twice the
 * limit, which for a login form is not worth a sorted-set of timestamps.
 */
export async function consumeIpRequest(ip: string): Promise<IpVerdict> {
  const cutoff = new Date(Date.now() - IP_WINDOW_MS)

  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "AuthThrottle" ("key", "count", "windowStart", "updatedAt")
    VALUES (${`ip:${ip}`}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
  if (!row || row.count <= IP_MAX_REQUESTS) return { allowed: true }

  const resetsAt = row.windowStart.getTime() + IP_WINDOW_MS
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)),
  }
}

/* ---------------------------------------------------------- account gate */

/**
 * Whether this account is currently refusing attempts — either locked, or
 * still inside the delay imposed by the last failure.
 *
 * The caller must not tell them apart in what it returns to the client.
 */
export async function accountIsBlocked(key: string): Promise<boolean> {
  const row = await prisma.authThrottle.findUnique({
    where: { key },
    select: { lockedUntil: true, nextAttemptAt: true },
  })
  if (!row) return false

  const now = Date.now()
  if (row.lockedUntil && row.lockedUntil.getTime() > now) return true
  if (row.nextAttemptAt && row.nextAttemptAt.getTime() > now) return true
  return false
}

export type FailureOutcome = {
  failures: number
  /** True only on the attempt that crossed the threshold — the one that
   *  should trigger the notification, so a sustained attack sends one
   *  email per lockout rather than one per guess. */
  justLocked: boolean
}

/**
 * Records a failed attempt, extends the delay, and locks the account once
 * the threshold is crossed.
 *
 * Counting is a single statement; the delay and lock are computed from
 * what it returns. Two failures racing can therefore both be counted but
 * write the same lock time, which is the harmless direction — the lock
 * still happens, at worst a beat earlier than one of them expected.
 */
export async function recordFailure(key: string): Promise<FailureOutcome> {
  const staleAfter = new Date(Date.now() - LOCKOUT_MS)

  // A run of failures that stopped long ago is not evidence about this
  // one, so a quiet gap longer than the lockout starts the count again.
  const rows = await prisma.$queryRaw<{ count: number; notifiedAt: Date | null }[]>`
    INSERT INTO "AuthThrottle" ("key", "count", "windowStart", "updatedAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "AuthThrottle"."updatedAt" < ${staleAfter} THEN 1
        ELSE "AuthThrottle"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "AuthThrottle"."updatedAt" < ${staleAfter} THEN CURRENT_TIMESTAMP
        ELSE "AuthThrottle"."windowStart"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count", "notifiedAt"
  `

  const failures = rows[0]?.count ?? 1
  const alreadyNotified = rows[0]?.notifiedAt !== null
  const now = Date.now()

  if (failures >= MAX_FAILURES) {
    await prisma.authThrottle.update({
      where: { key },
      data: {
        lockedUntil: new Date(now + LOCKOUT_MS),
        nextAttemptAt: null, // the lock supersedes the per-attempt delay
        notifiedAt: alreadyNotified ? undefined : new Date(),
      },
    })
    return { failures, justLocked: !alreadyNotified }
  }

  await prisma.authThrottle.update({
    where: { key },
    data: { nextAttemptAt: new Date(now + delayAfter(failures)) },
  })
  return { failures, justLocked: false }
}

/** A successful sign-in clears the account's history. */
export async function clearFailures(key: string): Promise<void> {
  await prisma.authThrottle.deleteMany({ where: { key } })
}

/* ---------------------------------------------------------------- pruning */

/**
 * Drops rows nothing is waiting on any more.
 *
 * Runs on roughly one sign-in in fifty rather than on a schedule, because
 * the deployment has no scheduler and an unpruned table would grow one row
 * per address forever. Failures are swallowed: housekeeping must never be
 * the reason someone cannot log in.
 */
export async function pruneOccasionally(): Promise<void> {
  if (Math.random() > 0.02) return
  try {
    await prisma.authThrottle.deleteMany({
      where: { updatedAt: { lt: new Date(Date.now() - LOCKOUT_MS * 2) } },
    })
  } catch {
    // nothing to do about it here
  }
}
