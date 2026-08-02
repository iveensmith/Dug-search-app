import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizePhone, requireSession } from '@/lib/auth'
import { isValidState } from '@/lib/states'
import { isValidLga } from '@/lib/lgas'
import { Prisma } from '@/generated/prisma/client'

const bodySchema = z.object({
  pharmacyName: z.string().min(2).max(120),
  address: z.string().min(5).max(300),
  state: z.string().refine(isValidState, { message: 'Select a valid state' }),
  lga: z.string().min(1).max(80),
  phone: z.string().min(7).max(20),
  pcnLicenseNumber: z.string().min(3).max(60),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

// Registering an outlet requires being signed in as a pharmacy owner — the
// pharmacy is attached to the caller's account. Patients (and other roles)
// are refused; they need a separate PHARMACY_OWNER account, created via
// /register?type=pharmacy (one account per role — see the User model).
export async function POST(req: NextRequest) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session
  if (session.role !== 'PHARMACY_OWNER') {
    return NextResponse.json(
      { error: 'Pharmacy outlets are managed from a pharmacy owner account — create one, or log in with yours.' },
      { status: 403 },
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: `${issue.path.join('.')}: ${issue.message}` },
      { status: 400 },
    )
  }
  const data = parsed.data
  if (!isValidLga(data.state, data.lga)) {
    return NextResponse.json(
      { error: `"${data.lga}" is not an LGA in the selected state` },
      { status: 400 },
    )
  }

  const existing = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (existing) {
    return NextResponse.json(
      { error: 'This account already has a pharmacy outlet — each account can manage one.' },
      { status: 409 },
    )
  }

  try {
    await prisma.pharmacy.create({
      data: {
        name: data.pharmacyName,
        address: data.address,
        state: data.state,
        lga: data.lga,
        phone: normalizePhone(data.phone),
        pcnLicenseNumber: data.pcnLicenseNumber.trim().toUpperCase(),
        latitude: data.latitude,
        longitude: data.longitude,
        verificationStatus: 'PENDING',
        ownerUserId: session.userId,
      },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = String(e.meta?.target ?? '')
      const friendly = target.includes('pcn')
        ? 'A pharmacy with that PCN license number is already registered'
        : 'That pharmacy is already registered'
      return NextResponse.json({ error: friendly }, { status: 409 })
    }
    throw e
  }
}
