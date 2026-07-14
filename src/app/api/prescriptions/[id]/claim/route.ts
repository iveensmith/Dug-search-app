import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// Pharmacist claims a pending upload — first come, first served.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req, ['PHARMACIST'])
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  // Guarded update: only claims if still PENDING (atomic — no double-claim race)
  const { count } = await prisma.prescriptionUpload.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'CLAIMED', pharmacistUserId: session.userId },
  })
  if (count === 0) {
    return NextResponse.json(
      { error: 'Already claimed by another pharmacist (or not found)' },
      { status: 409 },
    )
  }
  return NextResponse.json({ ok: true })
}
