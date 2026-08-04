/**
 * Shared vocabulary for reservations, so the patient's list, the pharmacy's
 * queue and the search card all describe the same state the same way.
 *
 * The wording is deliberately non-committal on the pharmacy's behalf. A
 * reservation is a request to hold something; MediQuest takes no payment,
 * verifies nothing, and can't make a counter honour it. Copy that promised
 * otherwise would send someone across town on our word.
 */
export const RESERVATION_STATUSES = ['PENDING', 'READY', 'COLLECTED', 'CANCELLED', 'DECLINED'] as const

export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number]

type StatusMeta = {
  /** What the patient sees. */
  patient: string
  /** What the pharmacy sees. */
  pharmacy: string
  /** Tailwind classes for the badge. */
  tone: string
}

export const RESERVATION_STATUS_META: Record<ReservationStatusValue, StatusMeta> = {
  PENDING: {
    patient: 'Waiting on the pharmacy',
    pharmacy: 'New request',
    tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  },
  READY: {
    patient: 'Held for you',
    pharmacy: 'Set aside',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  COLLECTED: {
    patient: 'Collected',
    pharmacy: 'Collected',
    tone: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  },
  CANCELLED: {
    patient: 'You cancelled this',
    pharmacy: 'Patient cancelled',
    tone: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  },
  DECLINED: {
    patient: 'Pharmacy could not hold it',
    pharmacy: 'You declined',
    tone: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  },
}

/** Still live — the patient may still walk in and collect. */
export function isOpen(status: ReservationStatusValue): boolean {
  return status === 'PENDING' || status === 'READY'
}

/**
 * Which transitions each side may make. Both can mark a reservation
 * collected: the patient from their own list, the pharmacy at the counter.
 * Neither can reopen a closed one — that's a fresh reservation.
 */
export const PATIENT_TRANSITIONS: ReservationStatusValue[] = ['COLLECTED', 'CANCELLED']
export const PHARMACY_TRANSITIONS: ReservationStatusValue[] = ['READY', 'COLLECTED', 'DECLINED']

/**
 * Nobody chases these up, so an old PENDING request is probably dead. Used
 * only to flag it in the UI — the row is never touched automatically,
 * because quietly expiring someone's reservation is worse than showing a
 * stale one.
 */
export const STALE_AFTER_HOURS = 24

export function isStale(status: ReservationStatusValue, createdAt: string | Date): boolean {
  if (status !== 'PENDING') return false
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  return hours > STALE_AFTER_HOURS
}
