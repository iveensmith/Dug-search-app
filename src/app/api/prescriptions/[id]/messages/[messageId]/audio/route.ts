import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { canViewUpload } from '@/lib/prescriptions'
import { storage } from '@/lib/storage'

/**
 * A voice note sent inside a prescription conversation.
 *
 * Access is decided by the thread, not the message: the same rule that
 * governs who may read the conversation governs who may hear it. The
 * message is matched on its upload id as well as its own, so a message id
 * from someone else's thread cannot be played by pairing it with a thread
 * the caller happens to be allowed into.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const { id, messageId } = await context.params
  const upload = await prisma.prescriptionUpload.findUnique({
    where: { id },
    select: { patientUserId: true, pharmacistUserId: true, status: true },
  })
  if (!upload || !canViewUpload(session, upload)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const message = await prisma.prescriptionMessage.findFirst({
    where: { id: messageId, prescriptionUploadId: id },
    select: { audioKey: true },
  })
  if (!message?.audioKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const file = await storage.get(message.audioKey)
  if (!file) return NextResponse.json({ error: 'Voice note missing' }, { status: 404 })

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.data.length),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  })
}
