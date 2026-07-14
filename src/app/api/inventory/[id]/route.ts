import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

async function findOwnedItem(userId: string, itemId: string) {
  const item = await prisma.pharmacyInventory.findUnique({
    where: { id: itemId },
    include: { pharmacy: { select: { ownerUserId: true } } },
  })
  if (!item || item.pharmacy.ownerUserId !== userId) return null
  return item
}

const patchSchema = z.object({ inStock: z.boolean() })

// Toggle in-stock / out-of-stock
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const item = await findOwnedItem(session.userId, id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'inStock (boolean) required' }, { status: 400 })

  const updated = await prisma.pharmacyInventory.update({
    where: { id },
    data: { inStock: parsed.data.inStock },
  })
  return NextResponse.json({ item: { id: updated.id, inStock: updated.inStock, updatedAt: updated.updatedAt } })
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
