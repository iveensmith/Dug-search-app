import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession, requireSession } from '@/lib/auth'
import { summariseAggregate } from '@/lib/ratings'

type RouteContext = { params: Promise<{ id: string }> }

const score = z.coerce.number().int().min(1).max(5)

const bodySchema = z.object({
  availability: score,
  service: score,
  pricing: score,
  honesty: score,
  comment: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
})

/** Public summary for one pharmacy, plus the caller's own rating if signed in. */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params

  const [agg, recent] = await Promise.all([
    prisma.pharmacyRating.aggregate({
      where: { pharmacyId: id },
      _count: { _all: true },
      _avg: { availability: true, service: true, pricing: true, honesty: true },
    }),
    prisma.pharmacyRating.findMany({
      where: { pharmacyId: id, comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        comment: true,
        createdAt: true,
        ownerReply: true,
        ownerRepliedAt: true,
        user: { select: { displayName: true } },
      },
    }),
  ])

  const session = await getSession(req)
  const mine = session
    ? await prisma.pharmacyRating.findUnique({
        where: { pharmacyId_userId: { pharmacyId: id, userId: session.userId } },
        select: {
          availability: true,
          service: true,
          pricing: true,
          honesty: true,
          comment: true,
        },
      })
    : null

  return NextResponse.json({
    summary: summariseAggregate(agg._count._all, agg._avg),
    mine,
    comments: recent.map((r) => ({
      id: r.id,
      comment: r.comment,
      createdAt: r.createdAt,
      ownerReply: r.ownerReply,
      ownerRepliedAt: r.ownerRepliedAt,
      // First name only — ratings are public, full names are not needed
      author: r.user.displayName?.split(' ')[0] ?? 'A patient',
    })),
  })
}

/** Create or update the caller's rating. One per person per pharmacy. */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const { id } = await ctx.params
  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id },
    select: { id: true, ownerUserId: true, verificationStatus: true },
  })
  if (!pharmacy) return NextResponse.json({ error: 'Unknown pharmacy' }, { status: 404 })

  // Owners rating their own shop would make the score meaningless
  if (pharmacy.ownerUserId === session.userId) {
    return NextResponse.json({ error: 'You cannot rate your own pharmacy' }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give every category a score from 1 to 5' }, { status: 400 })
  }
  const data = parsed.data

  await prisma.pharmacyRating.upsert({
    where: { pharmacyId_userId: { pharmacyId: id, userId: session.userId } },
    create: { pharmacyId: id, userId: session.userId, ...data },
    update: data,
  })

  const agg = await prisma.pharmacyRating.aggregate({
    where: { pharmacyId: id },
    _count: { _all: true },
    _avg: { availability: true, service: true, pricing: true, honesty: true },
  })

  return NextResponse.json(
    { summary: summariseAggregate(agg._count._all, agg._avg) },
    { status: 201 },
  )
}
