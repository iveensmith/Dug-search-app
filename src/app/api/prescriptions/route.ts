import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { cursorPage, cursorResult } from '@/lib/pagination'
import { storage, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/storage'
import { normaliseUpload, STORED_IMAGE_TYPE } from '@/lib/images'
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  clampReportedDuration,
  normaliseAudioType,
} from '@/lib/audioNotes'

// POST: patient uploads a prescription photo
// (multipart: image, note?, audio?, audioDuration?)
export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PATIENT'])
  if (session instanceof NextResponse) return session

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Send the photo as form data' }, { status: 400 })

  const image = form.get('image')
  const note = form.get('note')
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: 'Attach a photo of the prescription' }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
    return NextResponse.json({ error: 'Use a JPG, PNG, or WebP photo' }, { status: 400 })
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Photo is too large (max 20 MB)' }, { status: 400 })
  }

  // Stored as WebP at a readable size rather than as sent. A phone photo
  // is several megabytes; the pharmacist and the patient each pull it back
  // down every time they open the thread.
  let normalised: Buffer
  try {
    normalised = await normaliseUpload(Buffer.from(await image.arrayBuffer()))
  } catch {
    // A file that says image/jpeg but isn't one lands here.
    return NextResponse.json({ error: "That file doesn't look like a photo" }, { status: 400 })
  }
  // Optional spoken note, for patients who can say what is wrong far more
  // precisely than they can type it in English. Validated before the photo
  // is stored so a rejected recording doesn't leave an orphan image.
  const audio = form.get('audio')
  let audioKey: string | null = null
  let audioType: ReturnType<typeof normaliseAudioType> = null
  if (audio instanceof File && audio.size > 0) {
    audioType = normaliseAudioType(audio.type)
    if (!audioType) {
      return NextResponse.json({ error: "That voice note isn't a format we can play" }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `That voice note is too long — keep it under ${MAX_AUDIO_SECONDS / 60} minutes` },
        { status: 400 },
      )
    }
  }

  // The photo is the submission. If it cannot be stored there is nothing
  // to send, and the patient deserves better than a bare 500 — the real
  // reason (a bucket that does not exist, a MIME type it will not accept,
  // a size limit) is in the log line below, greppable as [prescriptions].
  let key: string
  try {
    key = await storage.put(normalised, STORED_IMAGE_TYPE)
  } catch (e) {
    console.error('[prescriptions] image upload failed:', e)
    return NextResponse.json(
      { error: 'We could not store your photo just now. Try again in a moment.' },
      { status: 502 },
    )
  }

  // The voice note is optional, so a failure here must not throw away a
  // photo and a typed question that were fine. It used to: the image was
  // already in the bucket, the audio upload threw, the request 500'd, and
  // everything the patient had entered was lost — including the recording
  // they cannot easily make again. Now the query goes through without it
  // and the reply says so.
  let audioFailed = false
  if (audio instanceof File && audioType) {
    try {
      audioKey = await storage.put(Buffer.from(await audio.arrayBuffer()), audioType)
    } catch (e) {
      console.error('[prescriptions] voice note upload failed:', e)
      audioFailed = true
    }
  }

  let upload
  try {
    upload = await prisma.prescriptionUpload.create({
      data: {
        patientUserId: session.userId,
        imageKey: key,
        patientNote: typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null,
        audioKey,
        audioDurationSec: audioKey ? clampReportedDuration(form.get('audioDuration')) : null,
      },
    })
  } catch (e) {
    // Nothing points at these objects now, and they are a photograph of
    // somebody's prescription. Take them back out.
    console.error('[prescriptions] record failed, removing stored files:', e)
    await storage.delete(key).catch(() => {})
    if (audioKey) await storage.delete(audioKey).catch(() => {})
    return NextResponse.json(
      { error: 'We could not save your question just now. Try again in a moment.' },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      upload: { id: upload.id, status: upload.status },
      // The client says this out loud rather than leaving somebody to
      // notice their recording is missing from the thread.
      audioFailed,
    },
    { status: 201 },
  )
}

// GET: role-aware list
//  - patient: own uploads (+ unread message counts)
//  - pharmacist: unclaimed queue + their claimed threads (+ unread counts)
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PATIENT', 'PHARMACIST'])
  if (session instanceof NextResponse) return session

  const where =
    session.role === 'PATIENT'
      ? { patientUserId: session.userId }
      : { OR: [{ status: 'PENDING' as const }, { pharmacistUserId: session.userId }] }

  // Cursor, not offset: a pharmacist's queue gains rows while they read it,
  // and OFFSET on a moving list repeats or skips items between pages.
  const { take, cursorArgs } = cursorPage(req.nextUrl.searchParams)
  const rows = await prisma.prescriptionUpload.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: take + 1, // the extra row tells us there is another page
    ...cursorArgs,
    include: {
      patient: { select: { displayName: true } },
      pharmacist: { select: { displayName: true } },
      _count: {
        select: {
          messages: { where: { readAt: null, senderUserId: { not: session.userId } } },
        },
      },
    },
  })
  const { items: uploads, nextCursor } = cursorResult(rows, take)

  // Counted across every thread, not summed from this page — the tab-bar
  // badge would otherwise stop rising past the first twenty conversations.
  const unreadTotal = await prisma.prescriptionMessage.count({
    where: {
      readAt: null,
      senderUserId: { not: session.userId },
      upload:
        session.role === 'PATIENT'
          ? { patientUserId: session.userId }
          : { pharmacistUserId: session.userId },
    },
  })

  return NextResponse.json({
    nextCursor,
    unreadTotal,
    uploads: uploads.map((u) => ({
      id: u.id,
      status: u.status,
      patientNote: u.patientNote,
      hasAudio: u.audioKey !== null,
      audioDurationSec: u.audioDurationSec,
      patientName: u.patient.displayName ?? 'Patient',
      pharmacistName: u.pharmacist?.displayName ?? null,
      unreadCount: u._count.messages,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  })
}
