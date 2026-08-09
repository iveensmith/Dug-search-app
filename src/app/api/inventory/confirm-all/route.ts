import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

/**
 * Restamps every in-stock item as confirmed just now.
 *
 * Listings go stale after 24 hours (stockFreshness in lib/types), which is
 * what stops the app promising things it cannot know. The cost is that a
 * shop with sixty drugs greys out every single day, and the only way back
 * was editing sixty rows one at a time. Nobody does that, so the honest
 * outcome of having no bulk confirm is a catalogue that is permanently
 * stale — which is worse than the risk below.
 *
 * The risk being: a one-tap "yes, still there" is also a one-tap way to
 * make the freshness stamp lie. Three things keep it honest.
 *
 * 1. It only touches rows already marked in stock. It cannot bring
 *    anything back from out-of-stock, so it can never invent availability
 *    that was not already claimed — it only re-dates a claim.
 * 2. It is rate-limited to once every four hours. Confirming a shelf you
 *    have not looked at is a habit; making it impossible to do reflexively
 *    every few minutes keeps it closer to a real morning stock-check.
 * 3. The UI states the count and asks, rather than firing on a stray tap.
 *
 * Returns how many rows were touched and how many of those had gone stale,
 * so the client can say what actually happened rather than "done".
 */

/** Matches the 24-hour cliff in stockFreshness. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

/** How long an owner must wait before confirming the whole list again. */
const COOLDOWN_MS = 4 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { ownerUserId: session.userId },
    select: { id: true },
  })
  if (!pharmacy) {
    return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  }

  const now = Date.now()

  // The most recently touched in-stock row doubles as the record of when
  // the list was last confirmed — no extra column needed.
  const newest = await prisma.pharmacyInventory.findFirst({
    where: { pharmacyId: pharmacy.id, inStock: true },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  })

  if (!newest) {
    return NextResponse.json(
      { error: 'Nothing to confirm — none of your drugs are marked in stock.' },
      { status: 400 },
    )
  }

  const sinceLast = now - newest.updatedAt.getTime()
  if (sinceLast < COOLDOWN_MS) {
    const hours = Math.max(1, Math.ceil((COOLDOWN_MS - sinceLast) / (60 * 60 * 1000)))
    return NextResponse.json(
      {
        error: `Your list was confirmed recently. You can confirm it again in about ${hours} ${
          hours === 1 ? 'hour' : 'hours'
        }.`,
      },
      { status: 429 },
    )
  }

  const staleBefore = await prisma.pharmacyInventory.count({
    where: {
      pharmacyId: pharmacy.id,
      inStock: true,
      updatedAt: { lt: new Date(now - STALE_AFTER_MS) },
    },
  })

  // inStock is already true on every row this matches; writing it is what
  // makes Prisma's @updatedAt fire, which is the whole point.
  const { count } = await prisma.pharmacyInventory.updateMany({
    where: { pharmacyId: pharmacy.id, inStock: true },
    data: { inStock: true },
  })

  return NextResponse.json({ confirmed: count, refreshed: staleBefore })
}
