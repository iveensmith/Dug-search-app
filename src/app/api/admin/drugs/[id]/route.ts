import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { Prisma } from '@/generated/prisma/client'
import { isValidCategory } from '@/lib/drugCategories'
import { isDispensingClass } from '@/lib/dispensing'

const FORMS = [
  'TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM',
  'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'SUPPOSITORY', 'OTHER',
] as const

/**
 * Fields an admin may clear as well as set. Empty string means "back to
 * unclassified", which is a real answer and has to stay reachable — an
 * admin who marked the wrong drug prescription-only needs a way back to
 * silence, not only a way to a different claim.
 *
 * The undefined check is load-bearing. `.optional().transform()` still
 * runs the transform when the key is absent, so the obvious `v ? v : null`
 * turns "didn't mention it" into "clear it": a PATCH sending only a
 * corrected spelling would quietly un-classify the drug. Absent has to
 * stay undefined so Prisma leaves the column alone.
 */
const clearable = <T extends string>(check: (v: string) => v is T, message: string) =>
  z
    .string()
    .refine((v): v is T | '' => v === '' || check(v), { message })
    .optional()
    .transform((v) => (v === undefined ? undefined : v === '' ? null : (v as T)))

const patchSchema = z.object({
  genericName: z.string().min(2).max(120).optional(),
  brandNames: z.array(z.string().min(1).max(80)).max(20).optional(),
  strength: z.string().min(1).max(60).optional(),
  form: z.enum(FORMS).optional(),
  category: clearable(isValidCategory, 'Unknown drug category'),
  dispensing: clearable(isDispensingClass, 'Unknown dispensing class'),
})

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: `${issue.path.join('.')}: ${issue.message}` },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const drug = await prisma.drug.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ drug })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (e.code === 'P2002') {
        return NextResponse.json(
          { error: 'Another drug with that generic name, strength, and form already exists' },
          { status: 409 },
        )
      }
    }
    throw e
  }
}
