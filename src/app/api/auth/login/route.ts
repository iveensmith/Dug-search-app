import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  findUsersByIdentifier,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '@/lib/auth'
import { PORTAL_ROLES } from '@/lib/roles'

const bodySchema = z.object({
  identifier: z.string().min(3).max(200), // email or phone
  password: z.string().min(1).max(200),
  // Which portal tab the login form had open. Defaults to the patient tab
  // so a body without it can't quietly skip the role check below.
  portal: z.enum(['patient', 'pharmacy']).default('patient'),
})

const NO_ACCOUNT_MESSAGE = {
  pharmacy:
    'No pharmacy account is registered with that email. Register your pharmacy to create one — you can use the same email as your patient account.',
  patient: 'No patient account is registered with that email. Create one — it only takes a minute.',
} as const

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email/phone and password' }, { status: 400 })
  }
  const { identifier, password, portal } = parsed.data

  // Email/phone are unique per-role, not globally, so one identifier can
  // match a patient account and a separate pharmacy account. The tab the
  // user picked decides which of those they are allowed to open: a patient
  // account is not a pharmacy account, whatever its password is.
  const allowed = PORTAL_ROLES[portal]
  const candidates = (await findUsersByIdentifier(identifier)).filter((u) =>
    allowed.includes(u.role),
  )

  // Deliberately distinguished from a wrong password: the whole point is to
  // tell someone that this side of the app has no account for them yet, so
  // they know to register rather than keep retrying the password. It does
  // reveal that no account exists on this side for that email — the sign-up
  // form already gives that away by rejecting duplicates. It still never
  // says anything about the *other* side.
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: NO_ACCOUNT_MESSAGE[portal], needsAccount: portal },
      { status: 401 },
    )
  }

  let user = null
  for (const candidate of candidates) {
    if (await verifyPassword(password, candidate.passwordHash)) {
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
