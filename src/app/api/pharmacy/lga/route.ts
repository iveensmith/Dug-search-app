import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { isValidLga } from '@/lib/lgas'

const bodySchema = z.object({ lga: z.string().min(1).max(80) })

// Sets the caller's pharmacy LGA — required data since searches filter by
// it; this endpoint exists so outlets registered before LGAs existed can
// fill theirs in from the dashboard.
export async function PATCH(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Pick your LGA' }, { status: 400 })
  }

  const pharmacy = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  if (!isValidLga(pharmacy.state, parsed.data.lga)) {
    return NextResponse.json(
      { error: `"${parsed.data.lga}" is not an LGA in your pharmacy's state` },
      { status: 400 },
    )
  }

  const updated = await prisma.pharmacy.update({
    where: { id: pharmacy.id },
    data: { lga: parsed.data.lga },
  })

  return NextResponse.json({ lga: updated.lga })
}
