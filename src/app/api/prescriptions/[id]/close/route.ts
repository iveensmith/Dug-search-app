import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// Either participant can close the thread when the question is resolved.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req, ['PATIENT', 'PHARMACIST'])
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const upload = await prisma.prescriptionUpload.findUnique({ where: { id } })
  const isParticipant =
    upload &&
    (upload.patientUserId === session.userId || upload.pharmacistUserId === session.userId)
  if (!upload || !isParticipant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (upload.status === 'CLOSED') return NextResponse.json({ ok: true })

  await prisma.prescriptionUpload.update({ where: { id }, data: { status: 'CLOSED' } })
  return NextResponse.json({ ok: true })
}
