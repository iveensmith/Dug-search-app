import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, setSessionCookie, signSession } from '@/lib/auth'
import {
  INVALID_INPUT_MESSAGE,
  logValidationFailure,
  readJsonBody,
  registerSchema,
} from '@/lib/authValidation'
import { isValidState } from '@/lib/states'
import { Prisma } from '@/generated/prisma/client'

// Sign-up: email is the only login identifier. accountType picks the role —
// 'patient' (default) or 'pharmacy' for a pharmacy owner account, which is
// what /pharmacy/register requires before an outlet can be added.
//
// The field rules live in lib/authValidation, shared with sign-in so the
// two endpoints cannot drift apart on what an email or a password is.
const bodySchema = registerSchema.extend({
  state: z.string().refine(isValidState).optional(),
})

export async function POST(req: NextRequest) {
  // Validated server-side regardless of what the form checked first.
  const body = await readJsonBody(req)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    logValidationFailure(
      'auth/register',
      req,
      parsed.error,
      typeof (body as { email?: unknown })?.email === 'string'
        ? (body as { email: string }).email
        : undefined,
    )
    // Deliberately says nothing about which field was wrong. The form
    // already shows the per-field rules as you type; this is the reply to
    // a caller that skipped the form.
    return NextResponse.json({ error: INVALID_INPUT_MESSAGE }, { status: 400 })
  }
  // email is lowercased and trimmed, displayName is stripped of markup and
  // re-checked, by the schema above — these are the cleaned values.
  const { email, displayName, password, state, accountType } = parsed.data

  try {
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: await hashPassword(password),
        role: accountType === 'pharmacy' ? 'PHARMACY_OWNER' : 'PATIENT',
        state,
      },
    })
    const res = NextResponse.json(
      { user: { id: user.id, role: user.role, displayName: user.displayName } },
      { status: 201 },
    )
    setSessionCookie(res, await signSession({ userId: user.id, role: user.role }))
    return res
  } catch (e) {
    // The unique constraint is [email, role], so this only fires when an
    // account of *this* type already exists. Say which, so someone whose
    // email is already a patient account isn't told to go and log in when
    // what they actually just did was create their pharmacy account.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        {
          error:
            accountType === 'pharmacy'
              ? 'A pharmacy account with that email already exists — log in on the pharmacy tab instead.'
              : 'A patient account with that email already exists — log in instead.',
        },
        { status: 409 },
      )
    }
    throw e
  }
}
