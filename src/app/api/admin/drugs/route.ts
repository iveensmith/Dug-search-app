import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { Prisma } from '@/generated/prisma/client'

const FORMS = [
  'TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM',
  'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'SUPPOSITORY', 'OTHER',
] as const

export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const drugs = await prisma.drug.findMany({
    include: { _count: { select: { inventory: true } } },
    orderBy: [{ genericName: 'asc' }, { strength: 'asc' }],
  })
  return NextResponse.json({
    drugs: drugs.map((d) => ({
      id: d.id,
      genericName: d.genericName,
      brandNames: d.brandNames,
      strength: d.strength,
      form: d.form,
      stockedByCount: d._count.inventory,
    })),
  })
}

const createSchema = z.object({
  genericName: z.string().min(2).max(120),
  brandNames: z.array(z.string().min(1).max(80)).max(20),
  strength: z.string().min(1).max(60),
  form: z.enum(FORMS),
})

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: `${issue.path.join('.')}: ${issue.message}` },
      { status: 400 },
    )
  }

  try {
    const drug = await prisma.drug.create({ data: parsed.data })
    return NextResponse.json({ drug }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'That drug (same generic name, strength, and form) already exists' },
        { status: 409 },
      )
    }
    throw e
  }
}
