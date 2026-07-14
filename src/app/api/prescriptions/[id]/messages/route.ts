import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { canMessageUpload } from '@/lib/prescriptions'

const bodySchema = z.object({ text: z.string().min(1).max(2000) })

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req, ['PATIENT', 'PHARMACIST'])
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Message text required' }, { status: 400 })

  const { id } = await context.params
  const upload = await prisma.prescriptionUpload.findUnique({ where: { id } })
  if (!upload || !canMessageUpload(session, upload)) {
    return NextResponse.json({ error: 'Not found or thread closed' }, { status: 404 })
  }

  const message = await prisma.prescriptionMessage.create({
    data: {
      prescriptionUploadId: id,
      senderUserId: session.userId,
      messageText: parsed.data.text.trim(),
    },
  })

  // First pharmacist reply moves the thread to ANSWERED
  if (session.role === 'PHARMACIST' && upload.status === 'CLAIMED') {
    await prisma.prescriptionUpload.update({ where: { id }, data: { status: 'ANSWERED' } })
  } else {
    await prisma.prescriptionUpload.update({ where: { id }, data: { updatedAt: new Date() } })
  }

  return NextResponse.json({ message: { id: message.id } }, { status: 201 })
}
