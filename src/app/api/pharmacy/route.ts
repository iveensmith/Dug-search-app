import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizePhone, requireSession } from '@/lib/auth'

const bodySchema = z.object({ confirmName: z.string().max(200) })

const patchSchema = z.object({
  phone: z.string().trim().min(7, 'That number looks too short').max(20),
})

/**
 * The counter's phone number. Editable, unlike the rest of the registered
 * details: a pharmacy that changes line or provider still needs patients
 * to be able to reach it, and a number nobody answers is worse than one
 * that was never verified. It identifies nothing on its own — the premises
 * is pinned by its address, coordinates and PCN licence, none of which
 * move.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Enter a valid phone number' },
      { status: 400 },
    )
  }

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { ownerUserId: session.userId },
    select: { id: true },
  })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const updated = await prisma.pharmacy.update({
    where: { id: pharmacy.id },
    // Same normalisation as registration, so "0803…" and "+234803…" don't
    // end up as two different-looking numbers depending on where they
    // were typed.
    data: { phone: normalizePhone(parsed.data.phone) },
    select: { phone: true },
  })

  return NextResponse.json({ phone: updated.phone })
}

/**
 * Deletes the caller's own outlet. This is the only way to change anything
 * fixed at registration — the name, address, state, LGA, map pin and PCN
 * number are what an admin checked, so they are not editable in place;
 * correcting them means registering again and going back through approval.
 *
 * The login account survives, so the owner can immediately register the
 * corrected outlet without signing up afresh.
 *
 * Typing the pharmacy name is required. Everything attached goes with it —
 * inventory, ratings, reservation history — and none of it comes back.
 */
export async function DELETE(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { ownerUserId: session.userId },
    select: { id: true, name: true },
  })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || parsed.data.confirmName.trim().toLowerCase() !== pharmacy.name.toLowerCase()) {
    return NextResponse.json(
      { error: `Type the pharmacy name exactly — "${pharmacy.name}" — to confirm.` },
      { status: 400 },
    )
  }

  // Someone is waiting on each of these. Deleting the outlet would drop
  // them without a word, so they have to be answered first — declining
  // them takes a tap and at least tells the patient to look elsewhere.
  const openReservations = await prisma.reservation.count({
    where: { pharmacyId: pharmacy.id, status: { in: ['PENDING', 'READY'] } },
  })
  if (openReservations > 0) {
    return NextResponse.json(
      {
        error: `${openReservations} patient${openReservations === 1 ? ' is' : 's are'} still waiting on a reservation. Answer those first — set aside or decline — then delete.`,
      },
      { status: 409 },
    )
  }

  // Inventory, ratings and reservations are all onDelete: Cascade
  const [inventory, ratings, reservations] = await Promise.all([
    prisma.pharmacyInventory.count({ where: { pharmacyId: pharmacy.id } }),
    prisma.pharmacyRating.count({ where: { pharmacyId: pharmacy.id } }),
    prisma.reservation.count({ where: { pharmacyId: pharmacy.id } }),
  ])

  await prisma.pharmacy.delete({ where: { id: pharmacy.id } })

  return NextResponse.json({ deleted: { inventory, ratings, reservations } })
}
