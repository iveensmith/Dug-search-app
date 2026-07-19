import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { optionalBrand, optionalDate } from '@/lib/inventoryFields'
import { Prisma } from '@/generated/prisma/client'

type RouteContext = { params: Promise<{ id: string }> }

async function findOwnedItem(userId: string, itemId: string) {
  const item = await prisma.pharmacyInventory.findUnique({
    where: { id: itemId },
    include: { pharmacy: { select: { ownerUserId: true } } },
  })
  if (!item || item.pharmacy.ownerUserId !== userId) return null
  return item
}

const patchSchema = z.object({
  inStock: z.boolean().optional(),
  brand: optionalBrand,
  expiryDate: optionalDate,
})

// Partial update — only fields actually present in the request body are
// touched (toggling stock shouldn't blank out an already-set brand/expiry)
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const item = await findOwnedItem(session.userId, id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const raw = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success || !raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  }

  const data: Prisma.PharmacyInventoryUpdateInput = {}
  if ('inStock' in raw) data.inStock = parsed.data.inStock
  if ('brand' in raw) data.brand = parsed.data.brand
  if ('expiryDate' in raw) data.expiryDate = parsed.data.expiryDate
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await prisma.pharmacyInventory.update({ where: { id }, data })
  return NextResponse.json({
    item: {
      id: updated.id,
      inStock: updated.inStock,
      brand: updated.brand,
      expiryDate: updated.expiryDate,
      updatedAt: updated.updatedAt,
    },
  })
}

// Remove a drug from this pharmacy's inventory
export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const item = await findOwnedItem(session.userId, id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.pharmacyInventory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
