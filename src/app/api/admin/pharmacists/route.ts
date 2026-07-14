import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, requireSession } from '@/lib/auth'
import { Prisma } from '@/generated/prisma/client'

// List pharmacist accounts (there is no self-service sign-up for this role —
// pharmacists are a vetted/licensed role, so only an admin can create one).
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const pharmacists = await prisma.user.findMany({
    where: { role: 'PHARMACIST' },
    select: {
      id: true,
      email: true,
      phone: true,
      displayName: true,
      createdAt: true,
      _count: { select: { claimedUploads: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    pharmacists: pharmacists.map((p) => ({
      id: p.id,
      email: p.email,
      phone: p.phone,
      displayName: p.displayName,
      claimedCount: p._count.claimedUploads,
      createdAt: p.createdAt,
    })),
  })
}

const createSchema = z.object({
  displayName: z.string().min(2).max(80),
  email: z.string().email().max(200),
  // Optional: admin can set one, otherwise we generate a temporary one to relay
  password: z.string().min(8).max(200).optional(),
})

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url') // ~12 chars, URL-safe
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 400 })
  }

  const tempPassword = parsed.data.password ?? generateTempPassword()
  try {
    const pharmacist = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        displayName: parsed.data.displayName,
        passwordHash: await hashPassword(tempPassword),
        role: 'PHARMACIST',
      },
    })
    return NextResponse.json(
      {
        pharmacist: { id: pharmacist.id, email: pharmacist.email, displayName: pharmacist.displayName },
        // Only returned once, at creation — relay this to the pharmacist yourself
        temporaryPassword: parsed.data.password ? null : tempPassword,
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 })
    }
    throw e
  }
}
