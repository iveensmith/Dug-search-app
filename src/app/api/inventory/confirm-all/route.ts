import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { confirmAllStock } from '@/lib/confirmAll'
import { logInventoryAction } from '@/lib/inventoryLog'

/**
 * The dashboard's "confirm my whole list" button.
 *
 * The rules about what a confirmation costs and what it may touch live in
 * lib/confirmAll, shared with the WhatsApp bot — two channels that
 * disagreed about the cooldown would make it meaningless, since staff
 * could just use the other one.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { ownerUserId: session.userId },
    select: { id: true },
  })
  if (!pharmacy) {
    return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  }

  const result = await confirmAllStock(pharmacy.id)

  if (!result.ok) {
    if (result.reason === 'nothing-in-stock') {
      return NextResponse.json(
        { error: 'Nothing to confirm — none of your drugs are marked in stock.' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      {
        error: `Your list was confirmed recently. You can confirm it again in about ${
          result.hoursLeft
        } ${result.hoursLeft === 1 ? 'hour' : 'hours'}.`,
      },
      { status: 429 },
    )
  }

  await logInventoryAction({
    pharmacyId: pharmacy.id,
    action: 'CONFIRMED_ALL',
    source: 'WEB',
    detail: `${result.confirmed} in stock, ${result.refreshed} were stale`,
  })

  return NextResponse.json({ confirmed: result.confirmed, refreshed: result.refreshed })
}
