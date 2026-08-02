import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  findUsersByIdentifier,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '@/lib/auth'

const bodySchema = z.object({
  identifier: z.string().min(3).max(200), // email or phone
  password: z.string().min(1).max(200),
  // Which portal tab the login form had open — used only to break ties when
  // the same identifier+password matches accounts in more than one role.
  portal: z.enum(['patient', 'pharmacy']).optional(),
})

const PORTAL_ROLE = { patient: 'PATIENT', pharmacy: 'PHARMACY_OWNER' } as const

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email/phone and password' }, { status: 400 })
  }

  // Email/phone are unique per-role, not globally, so the same identifier
  // can match more than one account (e.g. a patient and a pharmacy-owner
  // account sharing an email) — try the password against each candidate
  // rather than requiring the login form's portal tab to guess right. The
  // portal tab only orders the candidates, so when the same password opens
  // two accounts the user lands in the one they asked for.
  const candidates = await findUsersByIdentifier(parsed.data.identifier)
  const preferredRole = parsed.data.portal ? PORTAL_ROLE[parsed.data.portal] : null
  if (preferredRole) {
    candidates.sort((a, b) => Number(b.role === preferredRole) - Number(a.role === preferredRole))
  }
  let user = null
  for (const candidate of candidates) {
    if (await verifyPassword(parsed.data.password, candidate.passwordHash)) {
      user = candidate
      break
    }
  }
  if (!user) {
    return NextResponse.json({ error: 'Wrong email/phone or password' }, { status: 401 })
  }

  const res = NextResponse.json({
    user: { id: user.id, role: user.role, displayName: user.displayName },
  })
  setSessionCookie(res, await signSession({ userId: user.id, role: user.role }))
  return res
}
