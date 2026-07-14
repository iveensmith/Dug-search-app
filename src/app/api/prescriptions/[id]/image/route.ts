import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { canViewUpload } from '@/lib/prescriptions'
import { storage } from '@/lib/storage'

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

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      // Medical data on possibly-shared devices: never cache, even client-side
      'Cache-Control': 'no-store',
    },
  })
}
