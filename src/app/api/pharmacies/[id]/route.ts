import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { summarise, type RatingScores } from '@/lib/ratings'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Public profile for one pharmacy: who they are, when they're open, what
 * patients think, and what they currently have in stock. Only APPROVED
 * pharmacies are exposed — an unverified listing shouldn't be reachable by
 * guessing an id.
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

  const [items, ratingRows, itemCount, commentRows] = await Promise.all([
    prisma.pharmacyInventory.findMany({
      where: { pharmacyId: id, inStock: true },
      orderBy: { updatedAt: 'desc' },
      take: 60,
      include: { drug: true },
    }),
    prisma.pharmacyRating.findMany({
      where: { pharmacyId: id },
      select: { availability: true, service: true, pricing: true, honesty: true },
    }),
    prisma.pharmacyInventory.count({ where: { pharmacyId: id, inStock: true } }),
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
    itemCount,
    ratings: summarise(ratingRows as RatingScores[]),
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
    items: items.map((i) => ({
      id: i.id,
      brand: i.brand,
      stockUpdatedAt: i.updatedAt,
      drug: {
        id: i.drug.id,
        genericName: i.drug.genericName,
        brandNames: i.drug.brandNames,
        strength: i.drug.strength,
        form: i.drug.form,
        packSize: i.drug.packSize,
      },
    })),
  })
}
