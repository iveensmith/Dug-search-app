import { z } from 'zod'

// Shared zod pieces for the pharmacy-inventory "brand" + "expiry date" add-on
// fields — empty string (from an unfilled optional form field) means "not set".
export const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), { message: 'Invalid date' })

export const optionalBrand = z
  .string()
  .max(120)
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null))
