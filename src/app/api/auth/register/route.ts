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
import { issueVerifyUrl } from '@/lib/emailVerification'
import { sendVerifyEmail } from '@/lib/mail'
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
    // Best effort, and never allowed to fail the sign-up: the account
    // exists and works whether or not this mail leaves the building, and
    // an unverified account is blocked from nothing (lib/emailVerification).
    try {
      await sendVerifyEmail(user.email!, await issueVerifyUrl(user.id, req.nextUrl.origin))
    } catch (mailError) {
      console.error('[auth/register] verification email failed:', mailError)
    }

    const res = NextResponse.json(
      { user: { id: user.id, role: user.role, displayName: user.displayName } },
      { status: 201 },
    )
    setSessionCookie(res, await signSession({ userId: user.id, role: user.role }))
    return res
  } catch (e) {
    // The unique constraint is [email, role], so this only fires when an
    // account of this type already exists. The reply used to say so, and
    // which type — which turned sign-up into a way of testing whether an
    // address is registered here, without needing a password at all.
    //
    // It now says neither. What is left is a true statement that fits both
    // a taken address and a rejected one, and points at the two things
    // that help if the address really is yours.
    //
    // This narrows the gap rather than closing it: the response is still
    // a 409, and still arrives faster than a successful sign-up (which
    // hashes a password first). Closing it properly means not deciding
    // here at all — accept every sign-up, send a mail either way, and let
    // the link in it be the thing that proves the address. That is a
    // verification flow, and a bigger change than a string.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'Could not create that account. Try logging in, or reset your password.' },
        { status: 409 },
      )
    }
    throw e
  }
}
