import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { Prisma } from '@/generated/prisma/client'

const FORMS = [
  'TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM',
  'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'SUPPOSITORY', 'OTHER',
] as const

const patchSchema = z.object({
  genericName: z.string().min(2).max(120).optional(),
  brandNames: z.array(z.string().min(1).max(80)).max(20).optional(),
  strength: z.string().min(1).max(60).optional(),
  form: z.enum(FORMS).optional(),
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
