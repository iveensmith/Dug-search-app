import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const bodySchema = z.object({
  open24h: z.boolean(),
  opensAt: z.string().regex(HHMM, 'Use 24h HH:mm, e.g. 08:00').nullable().optional(),
  closesAt: z.string().regex(HHMM, 'Use 24h HH:mm, e.g. 21:00').nullable().optional(),
})

// Self-reported hours for the caller's own pharmacy — no verification, see
// src/lib/hours.ts for how "open now" is computed from these.
export async function PATCH(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid hours' }, { status: 400 })
  }
  const { open24h, opensAt, closesAt } = parsed.data

  const pharmacy = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const updated = await prisma.pharmacy.update({
    where: { id: pharmacy.id },
    data: open24h
      ? { open24h: true, opensAt: null, closesAt: null }
      : { open24h: false, opensAt: opensAt ?? null, closesAt: closesAt ?? null },
  })

  return NextResponse.json({
    open24h: updated.open24h,
    opensAt: updated.opensAt,
    closesAt: updated.closesAt,
  })
}
