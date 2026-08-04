/**
 * Therapeutic classes, as a controlled vocabulary rather than free text so
 * the tags stay consistent and remain filterable later. Deliberately broad
 * and patient-facing — this is "what is this drug for", not a clinical
 * classification system like ATC.
 *
 * A drug's category is always set by a person (an admin, or the pharmacy
 * that first lists it). Nothing infers it, and an unset category simply
 * shows no tag: a wrong class on a real medicine is worse than none.
 */
export const DRUG_CATEGORIES = [
  'Antimalarial',
  'Antibiotic',
  'Antifungal',
  'Antiviral',
  'Pain relief',
  'Anti-inflammatory',
  'Blood pressure',
  'Diabetes',
  'Heart and circulation',
  'Asthma and respiratory',
  'Allergy',
  'Stomach and digestion',
  'Deworming',
  'Vitamins and supplements',
  'Contraceptive',
  'Antiseptic and first aid',
  'Eye, ear and skin',
  'Mental health',
  'Other',
] as const

export type DrugCategory = (typeof DRUG_CATEGORIES)[number]

export function isValidCategory(value: string): value is DrugCategory {
  return (DRUG_CATEGORIES as readonly string[]).includes(value)
}

/** Normalises loose input (CSV imports, casing) onto the canonical list. */
export function matchCategory(raw: string | null | undefined): DrugCategory | null {
  if (!raw) return null
  const needle = raw.trim().toLowerCase()
  return DRUG_CATEGORIES.find((c) => c.toLowerCase() === needle) ?? null
}
