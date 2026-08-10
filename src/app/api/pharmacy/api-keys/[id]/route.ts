import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

/**
 * Revokes a key.
 *
 * Marked rather than deleted, so the audit log keeps the name of the key
 * that made past changes — "which key did this, and is it still trusted"
 * is exactly the question asked after something goes wrong.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const { id } = await ctx.params
  const pharmacy = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  // Scoped by pharmacyId in the same statement as the id, so an owner
  // cannot revoke another shop's key by guessing one.
  const result = await prisma.pharmacyApiKey.updateMany({
    where: { id, pharmacyId: pharmacy.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: 'No such key' }, { status: 404 })

  return NextResponse.json({ revoked: true })
}
