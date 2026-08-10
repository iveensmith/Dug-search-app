import { prisma } from './db'
import { emitEvent } from './webhooks'

/**
 * What a pharmacy's software is told about a reservation.
 *
 * Kept in one place so the created and updated events cannot drift into
 * describing the same thing two ways — an integrator writing against one
 * of them should not be surprised by the other.
 *
 * The patient's name and callback number are in here, because the point
 * is a counter being able to greet somebody and ring them if the hold is
 * about to lapse. That is also why the endpoint must be HTTPS and why
 * these payloads sit behind RLS: this is the most personal data the app
 * sends anywhere.
 */
export async function emitReservationEvent(
  reservationId: string,
  event: 'reservation.created' | 'reservation.updated',
): Promise<void> {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      quantity: true,
      note: true,
      contactPhone: true,
      readyAt: true,
      collectedAt: true,
      createdAt: true,
      pharmacyId: true,
      user: { select: { displayName: true, phone: true } },
      drug: { select: { id: true, genericName: true, strength: true, form: true, brandNames: true } },
    },
  })
  if (!r) return

  await emitEvent(r.pharmacyId, event, {
    reservation: {
      id: r.id,
      status: r.status,
      quantity: r.quantity,
      note: r.note,
      readyAt: r.readyAt,
      collectedAt: r.collectedAt,
      createdAt: r.createdAt,
    },
    patient: {
      name: r.user.displayName,
      // Whatever the counter should actually ring: what they typed on the
      // reservation if they typed one, otherwise the account's number.
      phone: r.contactPhone ?? r.user.phone,
    },
    drug: {
      id: r.drug.id,
      genericName: r.drug.genericName,
      strength: r.drug.strength,
      form: r.drug.form,
      brandNames: r.drug.brandNames,
    },
  })
}
