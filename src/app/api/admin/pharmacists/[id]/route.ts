import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// Revoke a pharmacist account. Their claimed uploads are left alone
// (pharmacistUserId keeps pointing at a now-deleted user's id would break FK,
// so we require reassigning/closing first — simplest MVP behavior: block if
// they have anything in flight, otherwise delete).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const openCount = await prisma.prescriptionUpload.count({
    where: { pharmacistUserId: id, status: { in: ['CLAIMED', 'ANSWERED'] } },
  })
  if (openCount > 0) {
    return NextResponse.json(
      { error: `This pharmacist has ${openCount} open conversation(s) — close them first` },
      { status: 409 },
    )
  }

  const { count } = await prisma.user.deleteMany({ where: { id, role: 'PHARMACIST' } })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
