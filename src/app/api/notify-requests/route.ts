import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isValidState } from '@/lib/states'

const bodySchema = z.object({
  drugId: z.string().min(1),
  state: z.string().refine(isValidState, { message: 'Unknown state' }),
  email: z.string().email().max(200),
})

// Anonymous — no login required, just captures demand on a zero-result
// search. Upsert on the (drugId, state, email) unique key so re-submitting
// doesn't create duplicates or re-arm an already-notified request.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  }
  const { drugId, state, email } = parsed.data

  const drug = await prisma.drug.findUnique({ where: { id: drugId } })
  if (!drug) return NextResponse.json({ error: 'Unknown drug' }, { status: 404 })

  await prisma.stockNotifyRequest.upsert({
    where: { drugId_state_email: { drugId, state, email: email.toLowerCase() } },
    create: { drugId, state, email: email.toLowerCase() },
    update: {},
  })

  return NextResponse.json({ ok: true })
}
