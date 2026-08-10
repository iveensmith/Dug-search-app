import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { drainDue } from '@/lib/webhooks'

/**
 * Sends whatever deliveries are due.
 *
 * This deployment has no scheduler (DEPLOY.md), so retries need something
 * to poke them. Point Vercel Cron, an uptime pinger, or a crontab on any
 * machine at this every few minutes.
 *
 * Guarded by a shared secret rather than a session, because the caller is
 * a machine with no account. With WEBHOOK_DRAIN_SECRET unset the route
 * refuses everything — an unauthenticated endpoint that makes outbound
 * requests on demand is a free traffic amplifier, and defaulting to open
 * would be the wrong way for a missing variable to fail.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.WEBHOOK_DRAIN_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'Draining is not configured' }, { status: 503 })
  }

  const header = req.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  // Constant-time, so the reply cannot be used to learn the secret one
  // character at a time.
  const ok =
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  if (!ok) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })

  const result = await drainDue(50)
  return NextResponse.json(result)
}
