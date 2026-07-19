import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const bodySchema = z.object({
  displayName: z.string().min(2).max(80),
})

export async function PATCH(req: NextRequest) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { displayName: parsed.data.displayName },
    select: { id: true, email: true, phone: true, displayName: true, role: true, state: true },
  })
  return NextResponse.json({ user })
}
