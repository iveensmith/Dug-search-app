import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { isValidLga } from '@/lib/lgas'

const bodySchema = z.object({ lga: z.string().min(1).max(80) })

/**
 * Fills in the caller's pharmacy LGA — once, and only while it is still
 * empty.
 *
 * The LGA is part of what an admin approved: it decides which patients see
 * this premises at all. An outlet that could move its own LGA could be
 * verified in one place and then relisted in another without anyone
 * re-checking it, so once set it is fixed. Changing it means deleting the
 * outlet and registering again, which puts it back through approval.
 *
 * The one-time write stays open because outlets registered before LGAs
 * existed have none, and searches filter by it — without this they would
 * be invisible to every patient, permanently, with no way to fix it.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Pick your LGA' }, { status: 400 })
  }

  const pharmacy = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  if (pharmacy.lga) {
    return NextResponse.json(
      {
        error:
          'Your LGA was set when this outlet was verified and cannot be changed. To move the listing, delete this outlet and register it again.',
      },
      { status: 409 },
    )
  }

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
