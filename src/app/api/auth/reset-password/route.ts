import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { hashPassword, setSessionCookie, signSession } from '@/lib/auth'
import {
  INVALID_INPUT_MESSAGE,
  logValidationFailure,
  newPasswordSchema,
  readJsonBody,
} from '@/lib/authValidation'

// Same password rule as sign-up — this route also decides what gets
// hashed and stored, so it cannot be the lenient way in.
const bodySchema = z.object({
  token: z.string().min(10).max(200),
  password: newPasswordSchema,
})

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await readJsonBody(req))
  if (!parsed.success) {
    logValidationFailure('auth/reset-password', req, parsed.error)
    return NextResponse.json({ error: INVALID_INPUT_MESSAGE }, { status: 400 })
  }
  const { token, password } = parsed.data
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const user = await prisma.user.findUnique({ where: { passwordResetTokenHash: tokenHash } })
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired — request a new one' },
      { status: 400 },
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  })

  const res = NextResponse.json({
    user: { id: user.id, role: user.role, displayName: user.displayName },
  })
  setSessionCookie(res, await signSession({ userId: user.id, role: user.role }))
  return res
}
