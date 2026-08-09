import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { cursorPage, cursorResult } from '@/lib/pagination'
import { canViewUpload, canMessageUpload } from '@/lib/prescriptions'

// Thread details + messages. Fetching as a participant marks the other
// side's messages as read (this is the in-app "notification" mechanism).
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const upload = await prisma.prescriptionUpload.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, displayName: true } },
      pharmacist: { select: { id: true, displayName: true } },
    },
  })
  if (!upload || !canViewUpload(session, upload)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isParticipant =
    upload.patientUserId === session.userId || upload.pharmacistUserId === session.userId
  if (isParticipant) {
    await prisma.prescriptionMessage.updateMany({
      where: { prescriptionUploadId: id, senderUserId: { not: session.userId }, readAt: null },
      data: { readAt: new Date() },
    })
  }

  // A thread is read newest-last, but paged newest-first: fetch the most
  // recent page in descending order, then flip it so the conversation still
  // reads top to bottom. "olderCursor" walks backwards into the history.
  const { take, cursorArgs } = cursorPage(req.nextUrl.searchParams)
  const rows = await prisma.prescriptionMessage.findMany({
    where: { prescriptionUploadId: id },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...cursorArgs,
    include: { sender: { select: { id: true, displayName: true, role: true } } },
  })
  const { items: newestFirst, nextCursor: olderCursor } = cursorResult(rows, take)
  const messages = [...newestFirst].reverse()

  return NextResponse.json({
    upload: {
      id: upload.id,
      status: upload.status,
      patientNote: upload.patientNote,
      hasAudio: upload.audioKey !== null,
      audioDurationSec: upload.audioDurationSec,
      patientName: upload.patient.displayName ?? 'Patient',
      pharmacistName: upload.pharmacist?.displayName ?? null,
      isMine: upload.patientUserId === session.userId,
      canMessage: canMessageUpload(session, upload),
      canClaim: session.role === 'PHARMACIST' && upload.status === 'PENDING',
      createdAt: upload.createdAt,
    },
    olderCursor,
    messages: messages.map((m) => ({
      id: m.id,
      text: m.messageText,
      hasAudio: m.audioKey !== null,
      audioDurationSec: m.audioDurationSec,
      mine: m.sender.id === session.userId,
      senderName: m.sender.displayName ?? (m.sender.role === 'PHARMACIST' ? 'Pharmacist' : 'Patient'),
      senderRole: m.sender.role,
      createdAt: m.createdAt,
    })),
  })
}
