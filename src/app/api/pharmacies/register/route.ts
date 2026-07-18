import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, normalizePhone, setSessionCookie, signSession } from '@/lib/auth'
import { isValidState } from '@/lib/states'
import { Prisma } from '@/generated/prisma/client'

const bodySchema = z.object({
  pharmacyName: z.string().min(2).max(120),
  address: z.string().min(5).max(300),
  state: z.string().refine(isValidState, { message: 'Select a valid state' }),
  phone: z.string().min(7).max(20),
  pcnLicenseNumber: z.string().min(3).max(60),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  ownerEmail: z.string().email().max(200),
  password: z.string().min(8).max(200),
})

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: `${issue.path.join('.')}: ${issue.message}` },
      { status: 400 },
    )
  }
  const data = parsed.data

  try {
    const { user } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.ownerEmail.toLowerCase(),
          passwordHash: await hashPassword(data.password),
          displayName: `${data.pharmacyName} Owner`,
          role: 'PHARMACY_OWNER',
        },
      })
      const pharmacy = await tx.pharmacy.create({
        data: {
          name: data.pharmacyName,
          address: data.address,
          state: data.state,
          phone: normalizePhone(data.phone),
          pcnLicenseNumber: data.pcnLicenseNumber.trim().toUpperCase(),
          latitude: data.latitude,
          longitude: data.longitude,
          verificationStatus: 'PENDING',
          ownerUserId: user.id,
        },
      })
      return { user, pharmacy }
    })

    const res = NextResponse.json({ ok: true }, { status: 201 })
    setSessionCookie(res, await signSession({ userId: user.id, role: user.role }))
    return res
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = String(e.meta?.target ?? '')
      const friendly = target.includes('email')
        ? 'An account with that email already exists'
        : target.includes('pcn')
          ? 'A pharmacy with that PCN license number is already registered'
          : 'That pharmacy is already registered'
      return NextResponse.json({ error: friendly }, { status: 409 })
    }
    throw e
  }
}
