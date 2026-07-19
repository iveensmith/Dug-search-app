// Mirrors the DrugForm Prisma enum — shared by anywhere that needs the list
// as a plain string array (zod validation, <select> options).
export const DRUG_FORMS = [
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'SUSPENSION',
  'INJECTION',
  'CREAM',
  'OINTMENT',
  'GEL',
  'DROPS',
  'INHALER',
  'SUPPOSITORY',
  'OTHER',
] as const

export type DrugFormValue = (typeof DRUG_FORMS)[number]

// Forms where a container/pack size (e.g. "30 g tube", "100 ml bottle") is
// meaningful, unlike a tablet/capsule which is just counted.
const SIZED_FORMS = new Set<DrugFormValue>([
  'SYRUP', 'SUSPENSION', 'CREAM', 'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'INJECTION', 'OTHER',
])

export function formUsesPackSize(form: string): boolean {
  return SIZED_FORMS.has(form as DrugFormValue)
}
