import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { findUserByIdentifier } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/mail'

const bodySchema = z.object({ identifier: z.string().min(3).max(200) })

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// Always responds { ok: true } regardless of whether the account exists (or
// has an email on file) — avoids leaking which identifiers are registered.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email or phone' }, { status: 400 })
  }

  const user = await findUserByIdentifier(parsed.data.identifier)
  if (user?.email) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })
    const resetUrl = `${req.nextUrl.origin}/reset-password?token=${token}`
    await sendPasswordResetEmail(user.email, resetUrl)
  }

  return NextResponse.json({ ok: true })
}
