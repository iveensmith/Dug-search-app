import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { offsetPage, offsetResult } from '@/lib/pagination'
import { summariseAggregate } from '@/lib/ratings'

/**
 * Every rating on the caller's own pharmacy, page by page.
 *
 * The public endpoint returns the five most recent comments, which is the
 * right amount next to a search result and not enough for an owner who
 * wants to read the lot. Scoped to the signed-in owner rather than taking
 * a pharmacy id, so there is no id to tamper with — same shape as the
 * other /api/pharmacy routes.
 *
 * Offset rather than cursor: a pharmacy's ratings are browsed, not
 * followed, they arrive slowly, and "showing 20 of 63" is worth the count.
 *
 * Scores with no comment are included. A 2-star with nothing written is
 * still the thing dragging an average down, and leaving it out would make
 * the list disagree with the number above it.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { ownerUserId: session.userId },
    select: { id: true, name: true },
  })
  if (!pharmacy) {
    return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  }

  const { take, skip, page } = offsetPage(req.nextUrl.searchParams)

  const [agg, total, rows] = await Promise.all([
    prisma.pharmacyRating.aggregate({
      where: { pharmacyId: pharmacy.id },
      _count: { _all: true },
      _avg: { availability: true, service: true, pricing: true, honesty: true },
    }),
    prisma.pharmacyRating.count({ where: { pharmacyId: pharmacy.id } }),
    prisma.pharmacyRating.findMany({
      where: { pharmacyId: pharmacy.id },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        availability: true,
        service: true,
        pricing: true,
        honesty: true,
        comment: true,
        ownerReply: true,
        createdAt: true,
        // First name only, matching what the patient was told when they
        // rated: "shown with your first name".
        user: { select: { displayName: true } },
      },
    }),
  ])

  const summary = summariseAggregate(agg._count._all, {
    availability: agg._avg.availability,
    service: agg._avg.service,
    pricing: agg._avg.pricing,
    honesty: agg._avg.honesty,
  })

  return NextResponse.json({
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name,
    summary,
    ...offsetResult(
      rows.map((r) => ({
        id: r.id,
        scores: {
          availability: r.availability,
          service: r.service,
          pricing: r.pricing,
          honesty: r.honesty,
        },
        // The mean of the four, so a row can be read at a glance without
        // the reader doing the arithmetic.
        overall: (r.availability + r.service + r.pricing + r.honesty) / 4,
        comment: r.comment,
        ownerReply: r.ownerReply,
        createdAt: r.createdAt,
        author: r.user.displayName?.split(' ')[0] ?? 'A patient',
      })),
      total,
      { take, page },
    ),
  })
}
