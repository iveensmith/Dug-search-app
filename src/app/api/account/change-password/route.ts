import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, requireSession, verifyPassword } from '@/lib/auth'

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
})

export async function POST(req: NextRequest) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } })
  const currentOk = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!currentOk) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  })
  return NextResponse.json({ ok: true })
}
