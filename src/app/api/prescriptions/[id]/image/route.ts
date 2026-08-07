import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { canViewUpload } from '@/lib/prescriptions'
import { storage } from '@/lib/storage'
import { acceptsWebp, toJpeg } from '@/lib/images'

// Prescription images are medical data: never public, always served
// through this access-checked route (storage keys are not URLs).
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const upload = await prisma.prescriptionUpload.findUnique({
    where: { id },
    select: { patientUserId: true, pharmacistUserId: true, status: true, imageKey: true },
  })
  if (!upload || !canViewUpload(session, upload)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const file = await storage.get(upload.imageKey)
  if (!file) return NextResponse.json({ error: 'Image missing' }, { status: 404 })

  // New uploads are stored as WebP. Anything that can't display it — and
  // anything uploaded before this changed, which is still JPEG or PNG on
  // disk — is served what it can actually read. This is the fallback: one
  // stored file, converted on the rare request that needs it, rather than
  // keeping two copies of every prescription.
  let body = file.data
  let contentType = file.contentType
  if (contentType === 'image/webp' && !acceptsWebp(req.headers.get('accept'))) {
    body = await toJpeg(file.data)
    contentType = 'image/jpeg'
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      // Varies by what the client can display, so anything in between must
      // not hand a WebP to a browser that asked for JPEG.
      Vary: 'Accept',
      // Medical data on possibly-shared devices: never cache, even client-side
      'Cache-Control': 'no-store',
    },
  })
}
