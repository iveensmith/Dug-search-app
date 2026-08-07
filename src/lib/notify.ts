import { prisma } from './db'
import { sendReservationRequestEmail, sendStockAvailableEmail } from './mail'
import { drugLabel } from './types'

/**
 * Called whenever a pharmacy's inventory row transitions to inStock=true.
 * Emails every pending StockNotifyRequest for that drug in that pharmacy's
 * state, then marks them notified so they don't fire again.
 */
export async function notifyStockAvailable(drugId: string, pharmacyId: string): Promise<void> {
  return notifyStockAvailableForDrugs([drugId], pharmacyId)
}

/**
 * The same thing for a batch of drugs — what a CSV import needs.
 *
 * Calling the single-drug version in a loop meant re-reading the same
 * pharmacy row once per drug, and one UPDATE per waiting patient. This is
 * a fixed four queries however many drugs came in: the pharmacy, the
 * drugs, the waiting requests, and one updateMany to close them out.
 */
export async function notifyStockAvailableForDrugs(
  drugIds: string[],
  pharmacyId: string,
): Promise<void> {
  if (drugIds.length === 0) return

  const [pharmacy, drugs] = await Promise.all([
    prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { name: true, state: true } }),
    prisma.drug.findMany({ where: { id: { in: drugIds } } }),
  ])
  if (!pharmacy || drugs.length === 0) return

  const pending = await prisma.stockNotifyRequest.findMany({
    where: { drugId: { in: drugs.map((d) => d.id) }, state: pharmacy.state, notifiedAt: null },
  })
  if (pending.length === 0) return

  const labels = new Map(drugs.map((d) => [d.id, drugLabel(d)]))

  // allSettled, so one bad address doesn't cost everyone else their email
  // — and only the ones that actually went out get marked notified, or a
  // failure here would silently swallow the notice for good.
  const results = await Promise.allSettled(
    pending.map((req) =>
      sendStockAvailableEmail(req.email, labels.get(req.drugId) ?? '', pharmacy.name),
    ),
  )
  const sent = pending.filter((_, i) => results[i].status === 'fulfilled').map((r) => r.id)
  if (sent.length > 0) {
    await prisma.stockNotifyRequest.updateMany({
      where: { id: { in: sent } },
      data: { notifiedAt: new Date() },
    })
  }
}

/**
 * Emails the pharmacy owner that a patient wants stock held. Best-effort:
 * an owner with no email on file simply doesn't get one, and the
 * reservation still shows in their dashboard. Never throws into the
 * request — the reservation itself is already saved by this point.
 */
export async function notifyReservationRequested(reservationId: string): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      quantity: true,
      note: true,
      contactPhone: true,
      user: { select: { displayName: true } },
      drug: true,
      pharmacy: { select: { owner: { select: { email: true } } } },
    },
  })
  const to = reservation?.pharmacy.owner.email
  if (!reservation || !to) return

  await sendReservationRequestEmail(
    to,
    drugLabel(reservation.drug),
    reservation.user.displayName ?? 'A patient',
    reservation.quantity,
    reservation.note,
    reservation.contactPhone,
  )
}
