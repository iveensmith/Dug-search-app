/**
 * How a medicine may legally be handed over: with a prescription, after a
 * word with the pharmacist, or straight off the shelf.
 *
 * This is the one fact about a drug that changes what a patient has to do
 * before setting off. Someone can find six pharmacies holding a POM,
 * travel to the nearest, and be turned away at the counter — the app was
 * right about the stock and still wasted the trip. Saying it up front is
 * the whole point.
 *
 * Three classes, matching how medicines are actually handed over in a
 * Nigerian pharmacy rather than any one register's wording:
 *
 *   POM            prescription required
 *   PHARMACY_ONLY  no prescription, but dispensed by a pharmacist
 *   OTC            general sale
 *
 * Null is the fourth state and the default, and it is deliberately silent.
 * Most of the catalogue is unclassified; a drug nobody has looked at shows
 * no badge and no note, because "no badge" must never be readable as "no
 * prescription needed". Classifying a medicine is a regulatory judgement,
 * so only an admin sets it — a pharmacy cannot declare its own stock OTC,
 * and nothing here is inferred from the name, the class, or anything else.
 */

export const DISPENSING_CLASSES = [
  {
    key: 'POM',
    /** On a chip, where width is scarce. */
    shortLabel: 'Rx',
    /** What the patient reads. */
    label: 'Prescription only',
    /** Said once, near the results, in plain terms. */
    note: 'A pharmacist can only hand this over against a valid prescription. The pharmacies below are shown so you know where to go — take your prescription with you.',
    /** What the pharmacy owner reads on their own shelf. */
    ownerLabel: 'Prescription only',
    tone: 'strong',
  },
  {
    key: 'PHARMACY_ONLY',
    shortLabel: 'P',
    label: 'Pharmacist only',
    note: 'You do not need a prescription, but this is kept behind the counter. The pharmacist will ask a few questions before handing it over.',
    ownerLabel: 'Pharmacist only',
    tone: 'quiet',
  },
  {
    key: 'OTC',
    shortLabel: 'OTC',
    label: 'Over the counter',
    note: 'You can buy this without a prescription.',
    ownerLabel: 'Over the counter',
    tone: 'plain',
  },
] as const

export type DispensingKey = (typeof DISPENSING_CLASSES)[number]['key']
export type DispensingTone = (typeof DISPENSING_CLASSES)[number]['tone']

export function isDispensingClass(v: unknown): v is DispensingKey {
  return typeof v === 'string' && DISPENSING_CLASSES.some((c) => c.key === v)
}

/** Null when nobody has classified the drug — callers must then say nothing. */
export function dispensingClass(key: string | null | undefined) {
  return DISPENSING_CLASSES.find((c) => c.key === key) ?? null
}

/** True only for a drug positively marked POM, never for an unclassified one. */
export function needsPrescription(key: string | null | undefined): boolean {
  return key === 'POM'
}
