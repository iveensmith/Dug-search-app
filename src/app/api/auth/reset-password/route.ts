import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { hashPassword, setSessionCookie, signSession } from '@/lib/auth'

const bodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
})

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a password with at least 8 characters' }, { status: 400 })
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
