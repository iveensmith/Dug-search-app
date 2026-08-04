import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, setSessionCookie, signSession } from '@/lib/auth'
import { isValidState } from '@/lib/states'
import { Prisma } from '@/generated/prisma/client'

// Sign-up: email is the only login identifier. accountType picks the role —
// 'patient' (default) or 'pharmacy' for a pharmacy owner account, which is
// what /pharmacy/register requires before an outlet can be added.
const bodySchema = z.object({
  email: z.string().email().max(200),
  displayName: z.string().min(2).max(80).optional(),
  password: z.string().min(8).max(200),
  state: z.string().refine(isValidState, { message: 'Select a valid state' }).optional(),
  accountType: z.enum(['patient', 'pharmacy']).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue.message }, { status: 400 })
  }
  const { email, displayName, password, state, accountType } = parsed.data

  try {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
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
