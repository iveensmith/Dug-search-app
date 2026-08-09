import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import {
  PATIENT_TRANSITIONS,
  PHARMACY_TRANSITIONS,
  RESERVATION_STATUSES,
  isOpen,
  type ReservationStatusValue,
} from '@/lib/reservations'

type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({ status: z.enum(RESERVATION_STATUSES) })

/**
 * Move a reservation along. Who may set what comes from lib/reservations —
 * the patient marks it collected or cancels, the pharmacy sets it aside,
 * hands it over, or declines.
 *
 * Closed reservations are final. Reopening one would let a pharmacy quietly
 * flip a cancelled request back to live, or a patient un-collect medicine
 * they already walked out with; making a new reservation is the honest way
 * to change your mind.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await requireSession(req, ['PATIENT', 'PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const { id } = await ctx.params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown reservation status' }, { status: 400 })
  }
  const next = parsed.data.status

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: { userId: true, status: true, pharmacy: { select: { ownerUserId: true } } },
  })
  if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

  const isPatient = reservation.userId === session.userId
  const isOwner = reservation.pharmacy.ownerUserId === session.userId
  if (!isPatient && !isOwner) {
    return NextResponse.json({ error: 'That is not your reservation' }, { status: 403 })
  }

  const allowed = isPatient ? PATIENT_TRANSITIONS : PHARMACY_TRANSITIONS
  if (!allowed.includes(next)) {
    return NextResponse.json({ error: 'You cannot set that status' }, { status: 403 })
  }

  // A lapsed hold is closed, with one exception: the patient turns up late
  // and the counter still has the pack. Refusing to record that would mean
  // the one case where everyone did the right thing is the one the app
  // can't write down. Nothing else may move an expired reservation.
  const status = reservation.status as ReservationStatusValue
  const lateCollection = status === 'EXPIRED' && next === 'COLLECTED'
  if (!isOpen(status) && !lateCollection) {
    return NextResponse.json(
      { error: 'This reservation is already closed — make a new one instead' },
      { status: 409 },
    )
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status: next,
      collectedAt: next === 'COLLECTED' ? new Date() : null,
      // Setting the pack aside starts the two-hour hold. Only stamped on
      // the way into READY, so a later collect or decline can't restart a
      // clock that has already run.
      ...(next === 'READY' ? { readyAt: new Date() } : {}),
    },
    select: { id: true, status: true, collectedAt: true, readyAt: true, pharmacyId: true },
  })

  return NextResponse.json({ reservation: updated })
}
