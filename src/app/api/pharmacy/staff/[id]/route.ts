import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

/**
 * Revokes a staff number.
 *
 * Deactivated rather than deleted: the number stops being able to change
 * anything immediately, and the log of what it did while it was trusted
 * keeps a name against it. Deleting would leave the owner with an audit
 * trail full of anonymous changes precisely when they most want to read
 * it — which is usually the moment they decided to revoke.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { ownerUserId: session.userId },
    select: { id: true },
  })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const { id } = await ctx.params
  // Scoped in the where clause, not checked afterwards: an owner must not
  // be able to revoke another shop's staff by guessing an id.
  const { count } = await prisma.pharmacyStaff.updateMany({
    where: { id, pharmacyId: pharmacy.id },
    data: { active: false },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ revoked: true })
}
