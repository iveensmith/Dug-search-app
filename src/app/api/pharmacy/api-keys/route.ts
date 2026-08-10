import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { issueApiKey } from '@/lib/apiKeys'

/** The owner's own view of their keys. Signed in with a session, not a key —
 *  a key can never mint another key, so a leaked one cannot entrench itself. */

const MAX_ACTIVE_KEYS = 5

async function ownPharmacy(userId: string) {
  return prisma.pharmacy.findUnique({ where: { ownerUserId: userId } })
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const keys = await prisma.pharmacyApiKey.findMany({
    where: { pharmacyId: pharmacy.id, revokedAt: null },
    // Never tokenHash: the point of hashing it is that nothing reads it back.
    select: { id: true, label: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ keys })
}

const createSchema = z.object({ label: z.string().trim().min(1).max(60) })

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  if (pharmacy.verificationStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Pharmacy not approved yet' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give the key a name, e.g. "Front counter POS"' }, { status: 400 })
  }

  const active = await prisma.pharmacyApiKey.count({
    where: { pharmacyId: pharmacy.id, revokedAt: null },
  })
  if (active >= MAX_ACTIVE_KEYS) {
    return NextResponse.json(
      { error: `You already have ${MAX_ACTIVE_KEYS} keys. Revoke one you no longer use.` },
      { status: 409 },
    )
  }

  const key = await issueApiKey(pharmacy.id, parsed.data.label)
  // The only time `raw` is ever returned. There is no endpoint that can
  // show it again, because only its hash was kept.
  return NextResponse.json({ key }, { status: 201 })
}
