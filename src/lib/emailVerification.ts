import crypto from 'crypto'
import { prisma } from '@/lib/db'

/**
 * Proving an email address belongs to the person who typed it.
 *
 * Deliberately blocks nothing. An unverified account can search, reserve,
 * upload a prescription and talk to a pharmacist exactly as before — the
 * app says the address is unconfirmed and offers to send the link again,
 * and that is all.
 *
 * That is a decision, not an omission. Verification depends on an email
 * arriving, which depends on a mail provider, a sending domain and a
 * patient's inbox; every one of those can fail quietly. Standing a wall
 * in front of a health tool and hinging it on that chain means the
 * failure mode is a person who cannot find out where their medicine is.
 * The wall is easy to add later — everything below already records the
 * fact — and impossible to take back from someone locked out today.
 *
 * What it does buy, now: a reset link that reaches a real inbox, a
 * pharmacist reply that reaches a real patient, and a signal an admin can
 * read when an account looks wrong.
 */

/** Long enough to survive a night without signal, short enough to matter. */
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

/** Stops a held-down "resend" turning into a mail flood. */
export const RESEND_COOLDOWN_MS = 60 * 1000

/**
 * Issues a token and returns the URL to email. The raw token is never
 * persisted — only its SHA-256, which is useless to anyone reading the
 * table.
 */
export async function issueVerifyUrl(userId: string, origin: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifyTokenHash: tokenHash,
      emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  })

  return `${origin}/verify-email?token=${token}`
}

/**
 * How long until another link may be sent.
 *
 * Derived from the outstanding token's expiry rather than a column of its
 * own: issued-at is expiry minus the TTL, and one fewer column is one
 * fewer thing to keep in step.
 */
export function resendWaitMs(expiresAt: Date | null): number {
  if (!expiresAt) return 0
  const issuedAt = expiresAt.getTime() - VERIFY_TOKEN_TTL_MS
  return Math.max(0, RESEND_COOLDOWN_MS - (Date.now() - issuedAt))
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
