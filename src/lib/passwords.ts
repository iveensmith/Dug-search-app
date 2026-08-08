/**
 * Password hashing, with nothing else behind it.
 *
 * Separate from lib/auth for the same reason lib/session is: auth pulls in
 * Prisma and next/server, and the seed scripts run under tsx with neither.
 * Everything that stores a password imports from here, so the work factor
 * is one number in one place rather than a literal repeated at each call
 * site — which is how the seeds ended up writing weaker hashes than the
 * app did.
 */

import bcrypt from 'bcryptjs'

/**
 * bcrypt work factor, applied to every password this app stores.
 *
 * 12 is the current OWASP figure. It is not free: bcryptjs is a pure-JS
 * implementation and each step up doubles the work — measured on the
 * development machine, a single hash or compare costs 99ms at cost 10 and
 * 327ms at 12, and a cold serverless instance will be slower still. That
 * cost is the whole point, since it multiplies the same way for anyone
 * testing a stolen table, but it lands on every sign-in. Raise it further
 * from measurements, not from instinct.
 */
export const BCRYPT_COST = 12

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/**
 * bcrypt.compare re-derives the hash using the salt stored inside it and
 * compares the digests in constant time — the answer takes the same time
 * whether the first byte differs or only the last.
 *
 * Never compare these with `===`. It returns at the first differing byte,
 * and that difference in timing is enough to walk a guess towards the real
 * value one byte at a time.
 */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** `$2b$12$…` → { cost: 12 }; null for anything that is not a bcrypt hash. */
export function parseBcrypt(hash: string): { cost: number } | null {
  const m = /^\$2[abxy]\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(hash)
  return m ? { cost: Number(m[1]) } : null
}

/**
 * Whether a stored hash should be rewritten the next time we hold the
 * plaintext — which is only ever during a successful sign-in.
 *
 * Raising BCRYPT_COST does nothing for accounts that already exist. Their
 * rows keep the cost they were written at, forever, unless something
 * rewrites them; the sign-in route is that something.
 *
 * A hash that is not bcrypt at all also lands here. Nothing in this
 * codebase has ever written one, and one could not authenticate anybody
 * if it did — bcrypt.compare would simply return false — so treating it
 * as "replace this" is both accurate and the safe direction. Deliberately
 * absent: any code that would *accept* an MD5 or SHA-1 password. Adding a
 * verifier for a weak scheme to rescue rows that do not exist would mean
 * shipping a way in that honours weak hashes. scripts/audit-password-hashes
 * reports what is actually stored instead.
 */
export function needsRehash(hash: string): boolean {
  const parsed = parseBcrypt(hash)
  return parsed === null || parsed.cost < BCRYPT_COST
}
