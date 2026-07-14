import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const patchSchema = z.object({
  verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
})

// Approve / reject / re-pend a pharmacy registration
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'verificationStatus required' }, { status: 400 })
  }

  const { id } = await context.params
  const pharmacy = await prisma.pharmacy.findUnique({ where: { id } })
  if (!pharmacy) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.pharmacy.update({
    where: { id },
    data: { verificationStatus: parsed.data.verificationStatus },
  })
  return NextResponse.json({
    pharmacy: { id: updated.id, verificationStatus: updated.verificationStatus },
  })
}
