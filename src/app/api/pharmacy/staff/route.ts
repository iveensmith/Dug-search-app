import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizePhone, requireSession } from '@/lib/auth'
import { Prisma } from '@/generated/prisma/client'
import { sanitizeDisplayName } from '@/lib/authValidation'

/**
 * The numbers allowed to update this pharmacy's stock over WhatsApp.
 *
 * Owner-only, and scoped to their own shop on every call. A staff number
 * is a credential with no password behind it, so who may issue one is the
 * entire access model: the owner adds it, the owner revokes it, and
 * nobody else can enumerate or touch the list.
 */

const createSchema = z.object({
  phone: z.string().min(7).max(30),
  displayName: z.string().max(80).optional(),
})

async function ownPharmacy(userId: string) {
  return prisma.pharmacy.findUnique({ where: { ownerUserId: userId }, select: { id: true } })
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const staff = await prisma.pharmacyStaff.findMany({
    where: { pharmacyId: pharmacy.id, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, phone: true, displayName: true, createdAt: true },
  })
  return NextResponse.json({ staff })
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
  }

  const phone = normalizePhone(parsed.data.phone)
  if (!/^\+?\d{10,15}$/.test(phone)) {
    return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
  }
  // The name is only ever read back to the owner, but it lands in emails
  // and dashboards elsewhere in this app, so it goes through the same
  // cleaner as every other display name.
  const displayName = parsed.data.displayName ? sanitizeDisplayName(parsed.data.displayName) : null

  // Revoked numbers are kept, not deleted, so the audit trail keeps a name
  // against what they did. Re-adding one reactivates that same row.
  const existing = await prisma.pharmacyStaff.findUnique({
    where: { phone },
    select: { id: true, pharmacyId: true, active: true },
  })
  if (existing && existing.pharmacyId !== pharmacy.id) {
    return NextResponse.json(
      { error: 'That number is already registered to another pharmacy.' },
      { status: 409 },
    )
  }
  if (existing) {
    const staff = await prisma.pharmacyStaff.update({
      where: { id: existing.id },
      data: { active: true, displayName },
      select: { id: true, phone: true, displayName: true, createdAt: true },
    })
    return NextResponse.json({ staff })
  }

  try {
    const staff = await prisma.pharmacyStaff.create({
      data: { pharmacyId: pharmacy.id, phone, displayName },
      select: { id: true, phone: true, displayName: true, createdAt: true },
    })
    return NextResponse.json({ staff }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'That number is already registered to another pharmacy.' },
        { status: 409 },
      )
    }
    throw e
  }
}
