import { prisma } from './db'

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
 * make the freshness stamp lie. Two things keep it honest here, and a
 * third belongs to the caller.
 *
 * 1. It only touches rows already marked in stock. It cannot bring
 *    anything back from out-of-stock, so it can never invent availability
 *    that was not already claimed — it only re-dates a claim.
 * 2. It is rate-limited to once every four hours. Confirming a shelf you
 *    have not looked at is a habit; making it impossible to do reflexively
 *    every few minutes keeps it closer to a real morning stock-check.
 * 3. The caller states the count and asks, rather than firing on a stray
 *    tap or a stray word.
 *
 * Shared by the dashboard button and the WhatsApp bot rather than
 * reimplemented for each: two channels that disagreed about what
 * "confirmed" costs would make the cooldown meaningless, since a staff
 * member could simply use the other one.
 */

/** Matches the 24-hour cliff in stockFreshness. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

/** How long before the whole list can be confirmed again. */
export const COOLDOWN_MS = 4 * 60 * 60 * 1000

export type ConfirmAllResult =
  | { ok: true; confirmed: number; refreshed: number }
  | { ok: false; reason: 'nothing-in-stock' }
  | { ok: false; reason: 'cooldown'; hoursLeft: number }

export async function confirmAllStock(pharmacyId: string): Promise<ConfirmAllResult> {
  const now = Date.now()

  // The most recently touched in-stock row doubles as the record of when
  // the list was last confirmed — no extra column needed.
  const newest = await prisma.pharmacyInventory.findFirst({
    where: { pharmacyId, inStock: true },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  })
  if (!newest) return { ok: false, reason: 'nothing-in-stock' }

  const sinceLast = now - newest.updatedAt.getTime()
  if (sinceLast < COOLDOWN_MS) {
    const hoursLeft = Math.max(1, Math.ceil((COOLDOWN_MS - sinceLast) / (60 * 60 * 1000)))
    return { ok: false, reason: 'cooldown', hoursLeft }
  }

  const refreshed = await prisma.pharmacyInventory.count({
    where: { pharmacyId, inStock: true, updatedAt: { lt: new Date(now - STALE_AFTER_MS) } },
  })

  // inStock is already true on every row this matches; writing it is what
  // makes Prisma's @updatedAt fire, which is the whole point.
  const { count } = await prisma.pharmacyInventory.updateMany({
    where: { pharmacyId, inStock: true },
    data: { inStock: true },
  })

  return { ok: true, confirmed: count, refreshed }
}
