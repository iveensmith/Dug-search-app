import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession, getSession } from '@/lib/auth'

/** A patient's saved medicines. Theirs alone — every query is scoped by
 *  the session's user id, never by anything in the request. */

const drugSelect = {
  id: true,
  genericName: true,
  brandNames: true,
  strength: true,
  form: true,
  packSize: true,
  category: true,
  dispensing: true,
} as const

export async function GET(req: NextRequest) {
  // Signed out is not an error here — the panel asks on every load, and a
  // 401 in the console on every visit trains people to ignore the console.
  const session = await getSession(req)
  if (!session || session.role !== 'PATIENT') return NextResponse.json({ drugs: [] })

  const saved = await prisma.savedDrug.findMany({
    where: { userId: session.userId },
    select: { drug: { select: drugSelect } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json({ drugs: saved.map((s) => s.drug) })
}

const bodySchema = z.object({ drugId: z.string().min(1).max(60) })

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PATIENT'])
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Pick a medicine' }, { status: 400 })

  const drug = await prisma.drug.findUnique({
    where: { id: parsed.data.drugId },
    select: drugSelect,
  })
  if (!drug) return NextResponse.json({ error: 'Unknown medicine' }, { status: 404 })

  // Upsert, so tapping save twice is not an error the patient has to
  // understand — the unique index makes it a no-op either way.
  await prisma.savedDrug.upsert({
    where: { userId_drugId: { userId: session.userId, drugId: drug.id } },
    create: { userId: session.userId, drugId: drug.id },
    update: {},
  })
  return NextResponse.json({ drug }, { status: 201 })
}
