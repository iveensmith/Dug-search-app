import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import {
  assertPublicHttpsUrl,
  newSecret,
  enqueueEvent,
  attemptDelivery,
  RECENT_DELIVERIES,
} from '@/lib/webhooks'

/**
 * The owner's own view of where their events go.
 *
 *   GET     the endpoint and its recent attempts
 *   PUT     set or replace the URL
 *   POST    send a test event
 *   DELETE  stop sending
 *
 * Session-authenticated, never key-authenticated: an API key must not be
 * able to redirect a pharmacy's patient data to a new address.
 */
async function ownPharmacy(userId: string) {
  return prisma.pharmacy.findUnique({ where: { ownerUserId: userId } })
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session
  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { pharmacyId: pharmacy.id },
    // Never the secret: it is shown once when set, and after that the
    // owner's copy is the only one that matters.
    select: {
      id: true,
      url: true,
      active: true,
      lastOkAt: true,
      createdAt: true,
      deliveries: {
        select: {
          id: true,
          event: true,
          attempts: true,
          deliveredAt: true,
          failedAt: true,
          lastStatus: true,
          lastError: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: RECENT_DELIVERIES,
      },
    },
  })
  return NextResponse.json({ endpoint })
}

const urlSchema = z.object({ url: z.string().trim().min(8).max(500) })

export async function PUT(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session
  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const parsed = urlSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give a URL' }, { status: 400 })

  // Checked before anything is stored, and the message is the owner's to
  // read — "not reachable from the public internet" is what they need to
  // hear, not a generic failure.
  try {
    await assertPublicHttpsUrl(parsed.data.url)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'That URL cannot be used.' },
      { status: 400 },
    )
  }

  // A new secret every time the URL changes: the old address should not
  // keep a working key to events it is no longer sent.
  const secret = newSecret()
  await prisma.webhookEndpoint.upsert({
    where: { pharmacyId: pharmacy.id },
    create: { pharmacyId: pharmacy.id, url: parsed.data.url, secret },
    update: { url: parsed.data.url, secret, active: true },
  })

  // The only time the secret is returned.
  return NextResponse.json({ url: parsed.data.url, secret })
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session
  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const id = await enqueueEvent(pharmacy.id, 'ping', {
    message: 'If you can read this, your endpoint is set up correctly.',
  })
  if (!id) return NextResponse.json({ error: 'No endpoint set' }, { status: 400 })

  const ok = await attemptDelivery(id)
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id },
    select: { lastStatus: true, lastError: true },
  })
  return NextResponse.json({ ok, ...delivery })
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session
  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  await prisma.webhookEndpoint.deleteMany({ where: { pharmacyId: pharmacy.id } })
  return NextResponse.json({ removed: true })
}
