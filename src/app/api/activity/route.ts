import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { limitPublicRead } from '@/lib/publicReadLimit'

/**
 * The last handful of stock confirmations across the network, for the
 * landing page's live feed.
 *
 * Same principle as /api/network-stats: everything here is read straight
 * from the database on the request, and the reassurance is meant to come
 * from the network visibly being alive — not from a number being large or
 * a name being recognisable.
 *
 * What a row carries and what it deliberately does not:
 *   - the drug (generic name + strength) and the area (LGA, or the state
 *     if the pharmacy has no LGA set) — enough to read as real activity
 *   - NOT the pharmacy's name or id. A public feed that names a shop
 *     broadcasts that shop's trading pattern to anyone watching the home
 *     page; the same call the stats route already made.
 *
 * One row per pharmacy (its most recent confirmation), so the feed shows
 * breadth across the network rather than one shop that just ran its
 * "confirm everything" pass twelve times.
 *
 * Approved pharmacies only — an unapproved shop's activity is not the
 * network's. Cached at the edge for a minute; nothing here is meaningfully
 * staler at sixty seconds and the home page requests it on every load.
 */
export async function GET(req: NextRequest) {
  const limited = await limitPublicRead(req, 'activity')
  if (limited) return limited

  const rows = await prisma.pharmacyInventory.findMany({
    where: { inStock: true, pharmacy: { verificationStatus: 'APPROVED' } },
    orderBy: { updatedAt: 'desc' },
    distinct: ['pharmacyId'],
    take: 12,
    select: {
      updatedAt: true,
      drug: { select: { genericName: true, strength: true } },
      pharmacy: { select: { lga: true, state: true } },
    },
  })

  const items = rows.map((r) => ({
    at: r.updatedAt,
    drug: r.drug.strength ? `${r.drug.genericName} ${r.drug.strength}` : r.drug.genericName,
    lga: r.pharmacy.lga,
    state: r.pharmacy.state,
  }))

  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
