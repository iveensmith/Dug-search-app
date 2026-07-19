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

// Accepts a number, a numeric string (from a form input), or empty/undefined
export const optionalQuantity = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : null
  })
  .refine((n) => n === null || n >= 0, { message: 'Quantity must be zero or more' })
