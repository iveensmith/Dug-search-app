import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { canMessageUpload } from '@/lib/prescriptions'
import { storage } from '@/lib/storage'
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  clampReportedDuration,
  normaliseAudioType,
} from '@/lib/audioNotes'

const textSchema = z.string().min(1).max(2000)

/**
 * A reply in a prescription conversation: text, a voice note, or both.
 *
 * Two content types on purpose. A voice note needs multipart, but every
 * typed reply — which is still most of them — keeps the plain JSON body
 * it always had rather than paying for a form encoding it has no use for.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req, ['PATIENT', 'PHARMACIST'])
  if (session instanceof NextResponse) return session

  const isForm = (req.headers.get('content-type') ?? '').includes('multipart/form-data')

  let text: string | null = null
  let audio: File | null = null
  let reportedDuration: unknown = null

  if (isForm) {
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Could not read that message' }, { status: 400 })
    const rawText = form.get('text')
    if (typeof rawText === 'string' && rawText.trim()) {
      const parsed = textSchema.safeParse(rawText.trim())
      if (!parsed.success) return NextResponse.json({ error: 'Message too long' }, { status: 400 })
      text = parsed.data
    }
    const rawAudio = form.get('audio')
    if (rawAudio instanceof File && rawAudio.size > 0) audio = rawAudio
    reportedDuration = form.get('audioDuration')
  } else {
    const parsed = z
      .object({ text: textSchema })
      .safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Message text required' }, { status: 400 })
    }
    text = parsed.data.text.trim()
  }

  // The database refuses a message that is neither (see the check
  // constraint in migration 20260809190000), but saying so here means a
  // stray tap on send gets a sentence rather than a 500.
  if (!text && !audio) {
    return NextResponse.json({ error: 'Type a message or record a voice note' }, { status: 400 })
  }

  const audioType = audio ? normaliseAudioType(audio.type) : null
  if (audio && !audioType) {
    return NextResponse.json({ error: "That voice note isn't a format we can play" }, { status: 400 })
  }
  if (audio && audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `That voice note is too long — keep it under ${MAX_AUDIO_SECONDS / 60} minutes` },
      { status: 400 },
    )
  }

  const { id } = await context.params
  const upload = await prisma.prescriptionUpload.findUnique({ where: { id } })
  if (!upload || !canMessageUpload(session, upload)) {
    return NextResponse.json({ error: 'Not found or thread closed' }, { status: 404 })
  }

  // Stored only once the thread is known to be writable, so a rejected
  // message can't leave a recording behind with nothing pointing at it.
  const audioKey =
    audio && audioType ? await storage.put(Buffer.from(await audio.arrayBuffer()), audioType) : null

  const message = await prisma.prescriptionMessage.create({
    data: {
      prescriptionUploadId: id,
      senderUserId: session.userId,
      messageText: text,
      audioKey,
      audioDurationSec: audioKey ? clampReportedDuration(reportedDuration) : null,
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
