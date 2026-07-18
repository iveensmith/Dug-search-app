import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, normalizePhone, setSessionCookie, signSession } from '@/lib/auth'
import { isValidState } from '@/lib/states'
import { Prisma } from '@/generated/prisma/client'

// Patient sign-up: email OR Nigerian phone number as the login identifier
const bodySchema = z
  .object({
    email: z.string().email().max(200).optional(),
    phone: z.string().min(7).max(20).optional(),
    displayName: z.string().min(2).max(80).optional(),
    password: z.string().min(8).max(200),
    state: z.string().refine(isValidState, { message: 'Select a valid state' }).optional(),
  })
  .refine((d) => d.email || d.phone, { message: 'Provide an email or phone number' })

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue.message }, { status: 400 })
  }
  const { email, phone, displayName, password, state } = parsed.data

  try {
    const user = await prisma.user.create({
      data: {
        email: email?.toLowerCase(),
        phone: phone ? normalizePhone(phone) : undefined,
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
        { error: 'An account with that email or phone already exists' },
        { status: 409 },
      )
    }
    throw e
  }
}
