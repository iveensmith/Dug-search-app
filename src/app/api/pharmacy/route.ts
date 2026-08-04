import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const bodySchema = z.object({ confirmName: z.string().max(200) })

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
