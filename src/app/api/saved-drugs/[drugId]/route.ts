import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ drugId: string }> }) {
  const session = await requireSession(req, ['PATIENT'])
  if (session instanceof NextResponse) return session

  const { drugId } = await ctx.params
  // Scoped by userId in the same statement, so one patient cannot remove
  // another's saved medicine by guessing a drug id.
  await prisma.savedDrug.deleteMany({ where: { userId: session.userId, drugId } })
  // Idempotent: removing something already gone is the outcome asked for.
  return NextResponse.json({ removed: true })
}
