import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, setSessionCookie, signSession } from '@/lib/auth'
import { isValidState } from '@/lib/states'
import { Prisma } from '@/generated/prisma/client'

// Patient sign-up: email is the only login identifier
const bodySchema = z.object({
  email: z.string().email().max(200),
  displayName: z.string().min(2).max(80).optional(),
  password: z.string().min(8).max(200),
  state: z.string().refine(isValidState, { message: 'Select a valid state' }).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue.message }, { status: 400 })
  }
  const { email, displayName, password, state } = parsed.data

  try {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        displayName,
        passwordHash: await hashPassword(password),
        role: 'PATIENT',
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with that email already exists' },
        { status: 409 },
      )
    }
    throw e
  }
}
