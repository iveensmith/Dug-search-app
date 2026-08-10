import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { notifyReservationRequested } from '@/lib/notify'
import { cursorPage, cursorResult } from '@/lib/pagination'
import { expireLapsedHolds } from '@/lib/expireHolds'
import { emitReservationEvent } from '@/lib/reservationEvents'

const bodySchema = z.object({
  pharmacyId: z.string().min(1),
  drugId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  note: z
    .string()
    .max(300)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  contactPhone: z
    .string()
    .max(30)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
})

const select = {
  id: true,
  quantity: true,
  note: true,
  contactPhone: true,
  status: true,
  readyAt: true,
  collectedAt: true,
  createdAt: true,
  pharmacy: { select: { id: true, name: true, address: true, phone: true, lga: true } },
  drug: {
    select: {
      id: true,
      genericName: true,
      brandNames: true,
      strength: true,
      form: true,
      packSize: true,
    },
  },
} as const

/** The signed-in patient's own reservations, newest first. */
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PATIENT'])
  if (session instanceof NextResponse) return session

  // Before reading, not after: a hold that ran out an hour ago must not
  // come back as live in this patient's own list.
  await expireLapsedHolds({ userId: session.userId })

  const { take, cursorArgs } = cursorPage(req.nextUrl.searchParams)
  // ?drugId= lets the search page ask "do I have an open reservation for
  // this drug" directly. Without it, it would have to page through the
  // patient's whole history to be sure.
  const drugId = req.nextUrl.searchParams.get('drugId')
  const openOnly = req.nextUrl.searchParams.get('open') === 'true'
  const rows = await prisma.reservation.findMany({
    where: {
      userId: session.userId,
      ...(drugId ? { drugId } : {}),
      ...(openOnly ? { status: { in: ['PENDING', 'READY'] as const } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...cursorArgs,
    select,
  })
  const { items: reservations, nextCursor } = cursorResult(rows, take)

  return NextResponse.json({ reservations, nextCursor })
}

/**
 * Ask a pharmacy to hold a drug. Patients only — a pharmacy owner reserving
 * stock from another shop through this app isn't a flow that exists, and
 * letting an owner file requests against a competitor is asking for abuse.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PATIENT'])
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Pick a pharmacy and a medicine' }, { status: 400 })
  }
  const { pharmacyId, drugId, quantity, note, contactPhone } = parsed.data

  // Only against a pharmacy a patient could actually have found — the same
  // approval gate the search uses. Reserving from an unapproved premises
  // would send someone to a shop we haven't checked.
  const item = await prisma.pharmacyInventory.findUnique({
    where: { pharmacyId_drugId: { pharmacyId, drugId } },
    select: { inStock: true, pharmacy: { select: { verificationStatus: true } } },
  })
  if (!item || item.pharmacy.verificationStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'That pharmacy does not list this medicine' }, { status: 404 })
  }
  if (!item.inStock) {
    return NextResponse.json(
      { error: 'That pharmacy has marked this out of stock — try another one nearby' },
      { status: 409 },
    )
  }

  // A hold that ran out is not an open reservation, and must not stand in
  // the way of asking again — so it is closed out before the check below.
  await expireLapsedHolds({ userId: session.userId, pharmacyId, drugId })

  // Reserving twice over should not create a second request for the counter
  // to work through. Hand back the one that's already open instead.
  const existing = await prisma.reservation.findFirst({
    where: { userId: session.userId, pharmacyId, drugId, status: { in: ['PENDING', 'READY'] } },
    select,
  })
  if (existing) {
    return NextResponse.json({ reservation: existing, alreadyOpen: true })
  }

  // Fall back to the phone on the account so the counter has some way to
  // reach them, but never overwrite what they typed in the form.
  const account = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { phone: true },
  })

  const reservation = await prisma.reservation.create({
    data: {
      userId: session.userId,
      pharmacyId,
      drugId,
      quantity,
      note,
      contactPhone: contactPhone ?? account?.phone ?? null,
    },
    select,
  })

  // Awaited, not fire-and-forget: on Vercel a detached promise can be killed
  // once the response is sent. A reservation the pharmacy never hears about
  // is the whole feature failing quietly.
  await notifyReservationRequested(reservation.id).catch((e) =>
    console.error('[notify] reservation email failed:', e),
  )

  // Same reasoning as the email above, and the same guarantee in the
  // other direction: the reservation is already saved, this is bounded by
  // a short timeout, and every failure is swallowed and retried later. A
  // pharmacy with a broken endpoint cannot cost a patient their hold.
  await emitReservationEvent(reservation.id, 'reservation.created')

  return NextResponse.json({ reservation }, { status: 201 })
}
