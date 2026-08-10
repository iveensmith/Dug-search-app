import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { summariseAggregate } from '@/lib/ratings'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Public profile for one pharmacy: who they are, when they're open, and
 * what patients think. Only APPROVED pharmacies are exposed — an
 * unverified listing shouldn't be reachable by guessing an id.
 *
 * Deliberately NOT what they have in stock. This used to return the shop's
 * whole in-stock list and a count of it, which any competitor could read
 * off a public page — a pharmacy's catalogue is its own commercial
 * information, and no patient needs it: the search answers "does this shop
 * have MY medicine", which is the only stock question they came with.
 *
 * Dropped from the response, not just from the page. Rendering less while
 * still sending it would leave the whole list one devtools tab away.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      state: true,
      lga: true,
      phone: true,
      latitude: true,
      longitude: true,
      verificationStatus: true,
      open24h: true,
      opensAt: true,
      closesAt: true,
    },
  })
  if (!pharmacy || pharmacy.verificationStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Pharmacy not found' }, { status: 404 })
  }

  const [ratingAgg, commentRows] = await Promise.all([
    prisma.pharmacyRating.aggregate({
      where: { pharmacyId: id },
      _count: { _all: true },
      _avg: { availability: true, service: true, pricing: true, honesty: true },
    }),
    prisma.pharmacyRating.findMany({
      where: { pharmacyId: id, comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        comment: true,
        createdAt: true,
        ownerReply: true,
        user: { select: { displayName: true } },
      },
    }),
  ])

  return NextResponse.json({
    pharmacy,
    ratings: summariseAggregate(ratingAgg._count._all, ratingAgg._avg),
    // The page renders these unconditionally — it read `comments` off this
    // response from the day it was written, and the field was never here,
    // so every pharmacy page threw on `comments.length`.
    comments: commentRows.map((c) => ({
      id: c.id,
      comment: c.comment,
      createdAt: c.createdAt,
      ownerReply: c.ownerReply,
      // First name only, matching the ratings endpoint — reviews are
      // public, full names don't need to be.
      author: c.user.displayName?.split(' ')[0] ?? 'A patient',
    })),
  })
}
