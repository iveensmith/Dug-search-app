import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/mail'

const bodySchema = z.object({ identifier: z.string().min(3).max(200) })

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// Always responds { ok: true } regardless of whether the account exists (or
// has an email on file) — avoids leaking which identifiers are registered.
//
// Email/phone are only unique per-role, so the same identifier can match
// more than one account (e.g. a patient account and a pharmacy-owner
// account) — reset every matching account and email each one separately.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email or phone' }, { status: 400 })
  }

  const id = parsed.data.identifier.trim()
  const users = await prisma.user.findMany({
    where: id.includes('@') ? { email: id.toLowerCase() } : { phone: normalizePhone(id) },
  })

  for (const user of users) {
    if (!user.email) continue
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
