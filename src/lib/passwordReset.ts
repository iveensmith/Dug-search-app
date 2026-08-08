/**
 * Issues a password-reset token.
 *
 * Shared by the "I forgot my password" form and the notice sent when an
 * account gets locked, so both hand out the same kind of link with the
 * same lifetime, and only the raw token ever leaves the process — what is
 * stored is its SHA-256, which is useless to anyone who reads the table.
 */

import crypto from 'crypto'
import { prisma } from '@/lib/db'

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/** Returns the URL to email. The token itself is never persisted. */
export async function issueResetUrl(userId: string, origin: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  })

  return `${origin}/reset-password?token=${token}`
}
