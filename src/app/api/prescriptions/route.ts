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

  const key = await storage.put(normalised, STORED_IMAGE_TYPE)
  if (audio instanceof File && audioType) {
    audioKey = await storage.put(Buffer.from(await audio.arrayBuffer()), audioType)
  }

  const upload = await prisma.prescriptionUpload.create({
    data: {
      patientUserId: session.userId,
      imageKey: key,
      patientNote: typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null,
      audioKey,
      audioDurationSec: audioKey ? clampReportedDuration(form.get('audioDuration')) : null,
    },
  })
  return NextResponse.json({ upload: { id: upload.id, status: upload.status } }, { status: 201 })
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
