import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ user: null })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, phone: true, displayName: true, role: true, state: true },
  })
  if (!user) return NextResponse.json({ user: null })

  // Lets the header hide "Add your pharmacy outlet" from owners who already
  // registered one (the API would reject a second outlet anyway).
  const hasPharmacy =
    user.role === 'PHARMACY_OWNER'
      ? (await prisma.pharmacy.count({ where: { ownerUserId: user.id } })) > 0
      : false

  return NextResponse.json({ user: { ...user, hasPharmacy } })
}
