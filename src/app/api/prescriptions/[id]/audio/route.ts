import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { canViewUpload } from '@/lib/prescriptions'
import { storage } from '@/lib/storage'

/**
 * The patient's spoken note on a prescription query.
 *
 * Someone describing their symptoms aloud is medical data in the most
 * literal sense — it is their own voice saying what is wrong with them —
 * so this is served exactly like the photo: through an access-checked
 * route, never a public URL, never cached.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const upload = await prisma.prescriptionUpload.findUnique({
    where: { id },
    select: { patientUserId: true, pharmacistUserId: true, status: true, audioKey: true },
  })
  if (!upload || !canViewUpload(session, upload)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!upload.audioKey) return NextResponse.json({ error: 'No voice note' }, { status: 404 })

  const file = await storage.get(upload.audioKey)
  if (!file) return NextResponse.json({ error: 'Voice note missing' }, { status: 404 })

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      // Lets the player show a scrub bar and seek, rather than only being
      // able to play from the start.
      'Content-Length': String(file.data.length),
      'Accept-Ranges': 'bytes',
      // Medical data on possibly-shared devices: never cache, even client-side.
      'Cache-Control': 'no-store',
    },
  })
}
