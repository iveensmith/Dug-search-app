import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { parseCsv, MAX_CSV_BYTES } from '@/lib/csv'
import { buildPreview } from '@/lib/inventoryImport'
import { logInventoryAction } from '@/lib/inventoryLog'
import { notifyStockAvailable } from '@/lib/notify'

/**
 * Importing a stock file, in two deliberate halves.
 *
 *   POST /api/inventory/import          parse and match, write nothing
 *   POST /api/inventory/import (apply)  write exactly what was confirmed
 *
 * Splitting them is the whole point. A stock listing is the one thing
 * this app asks patients to believe, and a spreadsheet is the easiest way
 * to get several hundred of them wrong at once. The owner sees what a
 * file would do before it does it, and the second call carries drug ids
 * the first one handed out — so the server never re-guesses, and a match
 * the owner corrected on screen is the match that gets written.
 */

const previewSchema = z.object({
  csv: z.string().min(1).max(MAX_CSV_BYTES),
})

const applySchema = z.object({
  apply: z.literal(true),
  items: z
    .array(
      z.object({
        drugId: z.string().min(1),
        quantity: z.number().int().min(0).nullable(),
        brand: z.string().max(120).nullable(),
        // ISO from the preview, which is the only thing that produces these.
        expiryDate: z.string().datetime().nullable(),
        inStock: z.boolean(),
      }),
    )
    .min(1)
    .max(2000),
})

async function ownPharmacy(userId: string) {
  return prisma.pharmacy.findUnique({ where: { ownerUserId: userId } })
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  if (pharmacy.verificationStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Pharmacy not approved yet' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)

  /* ------------------------------------------------------------- preview */
  const asPreview = previewSchema.safeParse(body)
  if (asPreview.success) {
    const parsed = parseCsv(asPreview.data.csv)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const preview = await buildPreview(parsed.table)
    if (preview.recognised.includes('name') === false) {
      return NextResponse.json(
        {
          error:
            'We could not find a column of medicine names. Name one column "Drug" (or "Product", or "Item") and try again.',
          headers: parsed.table.headers,
        },
        { status: 400 },
      )
    }
    return NextResponse.json(preview)
  }

  /* --------------------------------------------------------------- apply */
  const asApply = applySchema.safeParse(body)
  if (!asApply.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Ids come from the client, so they are checked rather than trusted —
  // this is the one place a crafted request could otherwise stock a
  // pharmacy with a drug that does not exist.
  const ids = [...new Set(asApply.data.items.map((i) => i.drugId))]
  const known = new Set(
    (await prisma.drug.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((d) => d.id),
  )
  const items = asApply.data.items.filter((i) => known.has(i.drugId))
  if (items.length === 0) {
    return NextResponse.json({ error: 'None of those medicines are in our list' }, { status: 400 })
  }

  // Sequential rather than one transaction: a file of several hundred rows
  // held open as a single transaction on a pooled serverless connection is
  // how you get a timeout that rolls back the lot. Each row is independent
  // and idempotent, so a partial import is a smaller harm than an
  // all-or-nothing one that reliably fails at size.
  let written = 0
  const newlyInStock: string[] = []
  for (const item of items) {
    const existing = await prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_drugId: { pharmacyId: pharmacy.id, drugId: item.drugId } },
      select: { inStock: true },
    })
    await prisma.pharmacyInventory.upsert({
      where: { pharmacyId_drugId: { pharmacyId: pharmacy.id, drugId: item.drugId } },
      create: {
        pharmacyId: pharmacy.id,
        drugId: item.drugId,
        inStock: item.inStock,
        brand: item.brand,
        quantity: item.quantity,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      },
      // An import states some things and is silent about others, and the
      // two are not the same. A file with no Brand column was wiping every
      // brand a pharmacy had recorded — including the ones patients search
      // by. Silence leaves the existing value alone; only a value actually
      // in the file overwrites one. Quantity 0 is a value, not silence.
      update: {
        inStock: item.inStock,
        ...(item.brand !== null && { brand: item.brand }),
        ...(item.quantity !== null && { quantity: item.quantity }),
        ...(item.expiryDate !== null && { expiryDate: new Date(item.expiryDate) }),
      },
    })
    written++
    if (item.inStock && !existing?.inStock) newlyInStock.push(item.drugId)
  }

  await logInventoryAction({
    pharmacyId: pharmacy.id,
    action: 'IMPORTED',
    source: 'CSV',
    detail: `${written} ${written === 1 ? 'medicine' : 'medicines'} updated from a file`,
  })

  // Same reasoning as the single-item add: awaited, because a detached
  // promise can be killed the moment the response is sent.
  for (const drugId of newlyInStock) {
    await notifyStockAvailable(drugId, pharmacy.id).catch((e) => console.error('[notify] failed:', e))
  }

  return NextResponse.json({ written })
}
