import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  findUserByIdentifier,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '@/lib/auth'

const bodySchema = z.object({
  identifier: z.string().min(3).max(200), // email or phone
  password: z.string().min(1).max(200),
})

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email/phone and password' }, { status: 400 })
  }

  const user = await findUserByIdentifier(parsed.data.identifier)
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'Wrong email/phone or password' }, { status: 401 })
  }

  const res = NextResponse.json({
    user: { id: user.id, role: user.role, displayName: user.displayName },
  })
  setSessionCookie(res, await signSession({ userId: user.id, role: user.role }))
  return res
}
