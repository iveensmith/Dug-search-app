import crypto from 'crypto'
import { prisma } from './db'
import { consumeWindow } from './rateLimit'

/**
 * Keys that let a pharmacy's own software write its own stock listings.
 *
 * The security property this file exists to hold: **the pharmacy is
 * derived from the key, never from the request.** No endpoint takes a
 * pharmacyId. A key is a statement about which shelf you are allowed to
 * describe, and there is no field a caller can set to describe a
 * different one — which is the only version of this that stays true when
 * somebody eventually sends a hand-written request.
 *
 * Only the SHA-256 is stored, so the table is not a list of working
 * credentials. The raw key is returned exactly once, at creation.
 */

/** Marks the string as ours in a log or a config file someone is reading. */
const PREFIX = 'mq_live_'

/** Characters of the raw key kept in clear, to tell two keys apart in a list. */
const VISIBLE = PREFIX.length + 6

/**
 * Requests one key may make per minute.
 *
 * Generous, because the shape of the job is bursty — a shop syncing four
 * hundred lines on opening does it in a handful of calls, then goes quiet
 * for a day. Low enough that a looping script is stopped before it costs
 * the database anything.
 */
export const API_MAX_REQUESTS = 60
export const API_WINDOW_MS = 60 * 1000

export function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export type IssuedKey = { id: string; label: string; prefix: string; raw: string }

/**
 * Mints a key for a pharmacy and returns it in the clear, once.
 *
 * 32 random bytes: this is a bearer credential with no second factor and
 * no expiry, so it has to be long enough that guessing is not a strategy.
 */
export async function issueApiKey(pharmacyId: string, label: string): Promise<IssuedKey> {
  const raw = PREFIX + crypto.randomBytes(32).toString('hex')
  const key = await prisma.pharmacyApiKey.create({
    data: {
      pharmacyId,
      label: label.trim().slice(0, 60) || 'Untitled key',
      tokenHash: hashKey(raw),
      prefix: raw.slice(0, VISIBLE),
    },
    select: { id: true, label: true, prefix: true },
  })
  return { ...key, raw }
}

export type AuthedKey = {
  keyId: string
  label: string
  pharmacyId: string
}

export type KeyAuthResult =
  | { ok: true; key: AuthedKey }
  | { ok: false; status: 401 | 403 | 429; error: string; retryAfterSeconds?: number }

/**
 * Resolves an Authorization header to the pharmacy it may write to.
 *
 * Order matters. The key is identified before it is rate limited, so one
 * shop's runaway script cannot exhaust another's allowance — a limit
 * keyed on the caller's address would do exactly that to two pharmacies
 * behind one office connection.
 *
 * Every rejection says the same thing about the key itself: an unknown
 * key and a revoked key are both "not valid", because the difference is
 * only useful to somebody testing which strings are real.
 */
export async function authenticateKey(req: Request): Promise<KeyAuthResult> {
  const header = req.headers.get('authorization') ?? ''
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!raw) {
    return { ok: false, status: 401, error: 'Send your key as: Authorization: Bearer <key>' }
  }

  const key = await prisma.pharmacyApiKey.findUnique({
    where: { tokenHash: hashKey(raw) },
    select: {
      id: true,
      label: true,
      revokedAt: true,
      pharmacy: { select: { id: true, verificationStatus: true } },
    },
  })
  if (!key || key.revokedAt) {
    return { ok: false, status: 401, error: 'That key is not valid.' }
  }

  // An unapproved pharmacy cannot publish stock through the dashboard
  // either. Letting the API do it would make the check a formality.
  if (key.pharmacy.verificationStatus !== 'APPROVED') {
    return { ok: false, status: 403, error: 'This pharmacy is not approved yet.' }
  }

  const verdict = await consumeWindow(`apikey:${key.id}`, API_MAX_REQUESTS, API_WINDOW_MS)
  if (!verdict.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Too many requests — try again in ${verdict.retryAfterSeconds}s.`,
      retryAfterSeconds: verdict.retryAfterSeconds,
    }
  }

  // Awaited, not fired and forgotten: on Vercel a detached promise can be
  // killed the moment the response is sent, so a "last used" that is only
  // sometimes written is worse than none — an owner would read a stale
  // date and revoke a key their POS is still using. One indexed update by
  // primary key is a cost worth paying for that. The catch is because a
  // failed timestamp is never a reason to refuse a stock update.
  await prisma.pharmacyApiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch((e) => console.error('[api-key] lastUsedAt failed:', e))

  return { ok: true, key: { keyId: key.id, label: key.label, pharmacyId: key.pharmacy.id } }
}
