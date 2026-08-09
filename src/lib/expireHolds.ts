import { prisma } from './db'
import { HOLD_HOURS } from './reservations'

/**
 * Closes out set-aside packs whose two hours are up.
 *
 * There is no scheduler in this app, and adding one for this would mean a
 * cron secret, a public endpoint and a job that is wrong whenever it fails
 * to fire. Instead the sweep runs on the paths that are about to read or
 * act on these rows anyway: the patient opening their list, the counter
 * opening its queue, and the check for an already-open reservation. By the
 * time anybody can see a lapsed hold, it has been closed.
 *
 * The cost is that a hold nobody looks at stays READY in the table for a
 * while. That is only ever a delay, never a wrong answer — no screen and
 * no decision reads the raw status without this having run first.
 *
 * Only READY lapses, and only with a readyAt: see the note on HOLD_HOURS.
 */
export async function expireLapsedHolds(scope: {
  userId?: string
  pharmacyId?: string
  drugId?: string
}): Promise<number> {
  // An unscoped updateMany here would rewrite every held reservation in
  // the database on a single page load. Nothing needs that, so nothing is
  // allowed to ask for it.
  if (!scope.userId && !scope.pharmacyId) {
    throw new Error('expireLapsedHolds needs a userId or a pharmacyId')
  }

  const cutoff = new Date(Date.now() - HOLD_HOURS * 3_600_000)
  const { count } = await prisma.reservation.updateMany({
    where: { ...scope, status: 'READY', readyAt: { lt: cutoff } },
    data: { status: 'EXPIRED' },
  })
  return count
}
