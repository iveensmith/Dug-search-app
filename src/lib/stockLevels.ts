/**
 * How much of a drug a pharmacy has, in the only terms a patient can act
 * on: is it worth the journey for what I need?
 *
 * Deliberately three bands and not a number. PharmacyInventory.quantity
 * exists, but it records a figure with no unit beside it — 12 could be
 * twelve boxes or twelve tablets — so it cannot be banded reliably and is
 * kept as the pharmacy's own note. The pharmacy states the band.
 *
 * Null is a real answer, and the default: "in stock, amount not stated",
 * which is what every listing meant before this existed. Nothing invents a
 * band for a row nobody has looked at.
 */

export const STOCK_LEVELS = [
  {
    key: 'PLENTY',
    /** What the pharmacy picks from. */
    ownerLabel: 'Plenty',
    ownerHint: 'A full course, or several',
    /** What the patient reads on a result. */
    patientLabel: 'Plenty in stock',
    tone: 'good',
  },
  {
    key: 'LOW',
    ownerLabel: 'Low',
    ownerHint: 'Enough for one person, probably',
    patientLabel: 'Low stock',
    tone: 'warn',
  },
  {
    key: 'LAST_FEW',
    ownerLabel: 'Last few',
    ownerHint: 'Worth a call before anyone travels',
    patientLabel: 'Last few left',
    tone: 'urgent',
  },
] as const

export type StockLevelKey = (typeof STOCK_LEVELS)[number]['key']
export type StockLevelTone = (typeof STOCK_LEVELS)[number]['tone']

export function isStockLevel(v: unknown): v is StockLevelKey {
  return typeof v === 'string' && STOCK_LEVELS.some((l) => l.key === v)
}

/** Null when the pharmacy has not said — callers fall back to "In stock". */
export function stockLevel(key: string | null | undefined) {
  return STOCK_LEVELS.find((l) => l.key === key) ?? null
}
