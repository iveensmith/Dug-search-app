/**
 * Shared vocabulary for reservations, so the patient's list, the pharmacy's
 * queue and the search card all describe the same state the same way.
 *
 * The wording is deliberately non-committal on the pharmacy's behalf. A
 * reservation is a request to hold something; MediQuest takes no payment,
 * verifies nothing, and can't make a counter honour it. Copy that promised
 * otherwise would send someone across town on our word.
 */
export const RESERVATION_STATUSES = [
  'PENDING',
  'READY',
  'COLLECTED',
  'CANCELLED',
  'DECLINED',
  'EXPIRED',
] as const

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
  // Not a failure on either side, and worded so neither reads blame. It
  // also must not imply the medicine is gone — the hold lapsed, the stock
  // almost certainly did not.
  EXPIRED: {
    patient: 'Hold expired',
    pharmacy: 'Hold expired',
    tone: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  },
}

/** Still live — the patient may still walk in and collect. */
export function isOpen(status: ReservationStatusValue): boolean {
  return status === 'PENDING' || status === 'READY'
}

/**
 * Which transitions each side may make. Both can mark a reservation
 * collected: the patient from their own list, the pharmacy at the counter.
 * Neither can reopen a closed one — that's a fresh reservation. EXPIRED is
 * absent from both lists on purpose: only the sweep below sets it.
 */
export const PATIENT_TRANSITIONS: ReservationStatusValue[] = ['COLLECTED', 'CANCELLED']
export const PHARMACY_TRANSITIONS: ReservationStatusValue[] = ['READY', 'COLLECTED', 'DECLINED']

/**
 * How long a pharmacy holds a pack once it has been set aside.
 *
 * Only READY lapses. A PENDING request has nothing physically put by, so
 * expiring it would take something from the patient and hand the counter
 * nothing back — that one keeps the 24-hour stale flag below and is never
 * touched automatically.
 *
 * Two hours is short enough that a pack isn't tied up all day for someone
 * who changed their mind, and long enough to cross a Nigerian city. The
 * number only works if it is visible: it is stated in the reserve dialog
 * before anyone commits, and counted down on the reservation afterwards,
 * so the lapse is never the first the patient hears of it.
 */
export const HOLD_HOURS = 2
const HOLD_MS = HOLD_HOURS * 3_600_000

/** When the hold runs out. Null when nothing is being held. */
export function holdExpiresAt(
  status: ReservationStatusValue,
  readyAt: string | Date | null | undefined,
): Date | null {
  if (status !== 'READY' || !readyAt) return null
  return new Date(new Date(readyAt).getTime() + HOLD_MS)
}

/**
 * "1h 40m left" / "12 min left" / null once it has run out.
 *
 * Computed at render rather than ticked. Every screen showing it fetches
 * on mount, so it is accurate when drawn, and a stopwatch counting to zero
 * in front of someone stuck in traffic would be its own kind of cruel.
 */
export function holdTimeLeft(
  status: ReservationStatusValue,
  readyAt: string | Date | null | undefined,
): string | null {
  const at = holdExpiresAt(status, readyAt)
  if (!at) return null
  const mins = Math.round((at.getTime() - Date.now()) / 60_000)
  if (mins <= 0) return null
  if (mins < 60) return `${mins} min left`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest === 0 ? `${hours}h left` : `${hours}h ${rest}m left`
}

/** A hold whose two hours are up but which nothing has closed out yet. */
export function isHoldLapsed(
  status: ReservationStatusValue,
  readyAt: string | Date | null | undefined,
): boolean {
  const at = holdExpiresAt(status, readyAt)
  return at !== null && at.getTime() <= Date.now()
}

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
