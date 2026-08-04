import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string; ratingId: string }> }

const bodySchema = z.object({
  reply: z
    .string()
    .max(500)
    .transform((v) => v.trim()),
})

/**
 * A pharmacy's public response to one rating. Only the owner of that
 * pharmacy may reply, and only to a rating that carries a comment — a
 * reply to a bare score would have nothing to answer. Sending an empty
 * string withdraws a previous reply.
 */
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const { id, ratingId } = await ctx.params

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id },
    select: { ownerUserId: true },
  })
  if (!pharmacy) return NextResponse.json({ error: 'Pharmacy not found' }, { status: 404 })
  if (pharmacy.ownerUserId !== session.userId) {
    return NextResponse.json({ error: 'That is not your pharmacy' }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Keep your reply under 500 characters' }, { status: 400 })
  }

  const rating = await prisma.pharmacyRating.findUnique({
    where: { id: ratingId },
    select: { pharmacyId: true, comment: true },
  })
  if (!rating || rating.pharmacyId !== id) {
    return NextResponse.json({ error: 'Rating not found' }, { status: 404 })
  }
  if (!rating.comment) {
    return NextResponse.json({ error: 'That rating has no comment to reply to' }, { status: 400 })
  }

  const reply = parsed.data.reply
  const updated = await prisma.pharmacyRating.update({
    where: { id: ratingId },
    data: {
      ownerReply: reply || null,
      ownerRepliedAt: reply ? new Date() : null,
    },
    select: { id: true, ownerReply: true, ownerRepliedAt: true },
  })

  return NextResponse.json({ rating: updated })
}
