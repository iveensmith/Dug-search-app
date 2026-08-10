import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateKey } from '@/lib/apiKeys'
import { DRUG_FORMS } from '@/lib/drugForms'
import { logInventoryAction } from '@/lib/inventoryLog'
import { notifyStockAvailable } from '@/lib/notify'
import { drainOccasionally } from '@/lib/webhooks'

/**
 * The public stock endpoint: what a pharmacy's own software talks to.
 *
 *   GET  /api/v1/inventory   what we currently list for this pharmacy
 *   POST /api/v1/inventory   set stock for one or more medicines
 *
 * There is no pharmacy id anywhere in either. The key decides whose shelf
 * this is, which is what makes "can this caller write that pharmacy's
 * stock" a question with one answer instead of a check somebody can
 * forget to write.
 *
 * A medicine is named either by our drugId, or by an exact
 * generic + strength + form. Exact — a name that fits two strengths is
 * rejected, not resolved. An integration runs unattended, so there is
 * nobody to notice a helpful guess putting the wrong box on the shelf.
 */

const MAX_ITEMS = 500

const itemSchema = z
  .object({
    drugId: z.string().min(1).max(60).optional(),
    genericName: z.string().min(2).max(120).optional(),
    strength: z.string().min(1).max(60).optional(),
    form: z.enum(DRUG_FORMS).optional(),
    inStock: z.boolean().default(true),
    quantity: z.number().int().min(0).max(1_000_000).nullish(),
    brand: z.string().max(120).nullish(),
    /** ISO 8601. Anything else is rejected rather than interpreted. */
    expiryDate: z.string().datetime().nullish(),
    /** Echoed back untouched, so a caller can line results up with its own rows. */
    ref: z.string().max(120).optional(),
  })
  .refine((i) => i.drugId || (i.genericName && i.strength && i.form), {
    message: 'Give drugId, or all of genericName, strength and form',
  })

const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(MAX_ITEMS) })

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await authenticateKey(req)
  // Without a scheduler, real traffic is the only clock there is — and a
  // POS polling this is the integration most likely to be waiting on a
  // retry. Sampled and capped, so it cannot slow the caller down.
  await drainOccasionally()
  if (!auth.ok) {
    return fail(auth.status, auth.error, auth.retryAfterSeconds ? { retryAfterSeconds: auth.retryAfterSeconds } : undefined)
  }

  const items = await prisma.pharmacyInventory.findMany({
    where: { pharmacyId: auth.key.pharmacyId },
    include: { drug: { select: { id: true, genericName: true, strength: true, form: true } } },
    orderBy: [{ drug: { genericName: 'asc' } }, { drug: { strength: 'asc' } }],
  })

  return NextResponse.json({
    items: items.map((i) => ({
      drugId: i.drugId,
      genericName: i.drug.genericName,
      strength: i.drug.strength,
      form: i.drug.form,
      inStock: i.inStock,
      quantity: i.quantity,
      brand: i.brand,
      expiryDate: i.expiryDate,
      updatedAt: i.updatedAt,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await authenticateKey(req)
  if (!auth.ok) {
    return fail(auth.status, auth.error, auth.retryAfterSeconds ? { retryAfterSeconds: auth.retryAfterSeconds } : undefined)
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return fail(400, parsed.error.issues[0]?.message ?? 'Invalid request body')
  }
  const { items } = parsed.data

  // Resolved in two bulk queries rather than one per item: a 500-line sync
  // should not be 500 round trips.
  const byId = new Map(
    (
      await prisma.drug.findMany({
        where: { id: { in: items.map((i) => i.drugId).filter((v): v is string => !!v) } },
        select: { id: true },
      })
    ).map((d) => [d.id, d.id]),
  )
  const named = items.filter((i) => !i.drugId)
  const matches = named.length
    ? await prisma.drug.findMany({
        where: {
          OR: named.map((i) => ({
            genericName: { equals: i.genericName!, mode: 'insensitive' as const },
            strength: { equals: i.strength!, mode: 'insensitive' as const },
            form: i.form!,
          })),
        },
        select: { id: true, genericName: true, strength: true, form: true },
      })
    : []

  const nameKey = (g: string, s: string, f: string) => `${g.toLowerCase()}|${s.toLowerCase()}|${f}`
  const byName = new Map<string, string[]>()
  for (const d of matches) {
    const k = nameKey(d.genericName, d.strength, d.form)
    byName.set(k, [...(byName.get(k) ?? []), d.id])
  }

  type Rejection = { index: number; ref?: string; reason: string }
  const rejected: Rejection[] = []
  const resolved: Array<{ index: number; drugId: string; item: (typeof items)[number] }> = []
  const seen = new Set<string>()

  items.forEach((item, index) => {
    let drugId: string | undefined
    if (item.drugId) {
      drugId = byId.get(item.drugId)
      if (!drugId) {
        rejected.push({ index, ref: item.ref, reason: `No medicine with id ${item.drugId}` })
        return
      }
    } else {
      const hits = byName.get(nameKey(item.genericName!, item.strength!, item.form!)) ?? []
      if (hits.length === 0) {
        rejected.push({
          index,
          ref: item.ref,
          reason: `No medicine matching ${item.genericName} ${item.strength} (${item.form})`,
        })
        return
      }
      if (hits.length > 1) {
        // Should not happen — Drug is unique on this triple — but a caller
        // deserves a refusal rather than an arbitrary pick if it ever does.
        rejected.push({ index, ref: item.ref, reason: 'That name matches more than one medicine' })
        return
      }
      drugId = hits[0]
    }

    if (seen.has(drugId)) {
      rejected.push({ index, ref: item.ref, reason: 'The same medicine appears earlier in this request' })
      return
    }
    seen.add(drugId)
    resolved.push({ index, drugId, item })
  })

  if (resolved.length === 0) {
    return NextResponse.json({ applied: 0, rejected }, { status: 422 })
  }

  const newlyInStock: string[] = []
  for (const { drugId, item } of resolved) {
    const existing = await prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_drugId: { pharmacyId: auth.key.pharmacyId, drugId } },
      select: { inStock: true },
    })
    await prisma.pharmacyInventory.upsert({
      where: { pharmacyId_drugId: { pharmacyId: auth.key.pharmacyId, drugId } },
      create: {
        pharmacyId: auth.key.pharmacyId,
        drugId,
        inStock: item.inStock,
        quantity: item.quantity ?? null,
        brand: item.brand ?? null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      },
      // Omitted fields keep what is already there, for the reason the CSV
      // import documents: a caller syncing quantities should not have to
      // resend every brand to avoid erasing them.
      update: {
        inStock: item.inStock,
        ...(item.quantity !== undefined && { quantity: item.quantity }),
        ...(item.brand !== undefined && { brand: item.brand }),
        ...(item.expiryDate !== undefined && {
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        }),
      },
    })
    if (item.inStock && !existing?.inStock) newlyInStock.push(drugId)
  }

  await logInventoryAction({
    pharmacyId: auth.key.pharmacyId,
    action: 'IMPORTED',
    source: 'API',
    detail: `${resolved.length} ${resolved.length === 1 ? 'medicine' : 'medicines'} updated via ${auth.key.label}`,
  })

  for (const drugId of newlyInStock) {
    await notifyStockAvailable(drugId, auth.key.pharmacyId).catch((e) =>
      console.error('[notify] failed:', e),
    )
  }

  // 200 with a rejection list rather than an all-or-nothing failure: a
  // nightly sync should not lose 499 good lines to one discontinued
  // product, and the list is what tells the integrator to go and fix it.
  return NextResponse.json({ applied: resolved.length, rejected })
}
