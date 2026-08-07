import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { cursorPage, cursorResult } from '@/lib/pagination'

/**
 * The counter's queue: every reservation against the signed-in owner's
 * pharmacy, open ones first. Includes the patient's name and callback
 * number — without a way to reach them, "held for you" is unworkable when
 * they don't turn up.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { ownerUserId: session.userId },
    select: { id: true },
  })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const { take, cursorArgs } = cursorPage(req.nextUrl.searchParams)
  const rows = await prisma.reservation.findMany({
    where: { pharmacyId: pharmacy.id },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...cursorArgs,
    select: {
      id: true,
      quantity: true,
      note: true,
      contactPhone: true,
      status: true,
      collectedAt: true,
      createdAt: true,
      user: { select: { displayName: true } },
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
    },
  })

  const { items, nextCursor } = cursorResult(rows, take)

  return NextResponse.json({
    nextCursor,
    reservations: items.map((r) => ({
      ...r,
      patientName: r.user.displayName ?? 'A patient',
      user: undefined,
    })),
  })
}
