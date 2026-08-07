import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { cursorPage, cursorResult } from '@/lib/pagination'
import { storage, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/storage'

// POST: patient uploads a prescription photo (multipart: image, note?)
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
    return NextResponse.json({ error: 'Photo is too large (max 10 MB)' }, { status: 400 })
  }

  const key = await storage.put(Buffer.from(await image.arrayBuffer()), image.type)
  const upload = await prisma.prescriptionUpload.create({
    data: {
      patientUserId: session.userId,
      imageKey: key,
      patientNote: typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null,
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
      patientName: u.patient.displayName ?? 'Patient',
      pharmacistName: u.pharmacist?.displayName ?? null,
      unreadCount: u._count.messages,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  })
}
