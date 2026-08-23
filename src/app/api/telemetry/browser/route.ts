import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { consumeWindow } from '@/lib/rateLimit'
import { clientIp } from '@/lib/loginThrottle'

/**
 * Counts a visit by how much of the app the browser can run.
 *
 * The head script in layout.tsx feature-detects the two floors described
 * in BROWSERS.md and posts one of three words. That is the entire
 * payload: no address, no user agent, no session, nothing that could be
 * tied back to a person looking up their own medicines. The table it
 * writes to has no column for any of that either.
 *
 * Open by necessity — the whole point is to hear from browsers that
 * cannot sign in, or in the worst case cannot run React at all — so it is
 * written to be dull to attack. The bucket must be one of three literals,
 * the body is capped, the write is a bounded counter increment, and a
 * caller gets a fixed allowance per hour. The worst an abuser achieves is
 * a wrong number in a build decision.
 */

const BUCKETS = ['supported', 'css_too_old', 'js_too_old'] as const
type Bucket = (typeof BUCKETS)[number]

/** Generous for real people (the client sends once per session), mean to a script. */
const PER_IP_PER_HOUR = 60
const HOUR_MS = 60 * 60 * 1000

/** Enough for {"bucket":"css_too_old"} and nothing interesting. */
const MAX_BODY_BYTES = 64

export async function POST(req: NextRequest) {
  // 204 whatever happens. This is fire-and-forget from a <head> script on
  // a browser that may be broken; there is no caller to read an error,
  // and a status code is the one thing a prober could learn from.
  const ok = new NextResponse(null, { status: 204 })

  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) return ok

    let bucket: unknown
    try {
      bucket = (JSON.parse(raw) as { bucket?: unknown }).bucket
    } catch {
      return ok
    }
    if (typeof bucket !== 'string' || !BUCKETS.includes(bucket as Bucket)) return ok

    const verdict = await consumeWindow(`browserstat:${clientIp(req)}`, PER_IP_PER_HOUR, HOUR_MS)
    if (!verdict.allowed) return ok

    // Midnight UTC, so a day is a day everywhere and the primary key
    // collapses every visit in it onto one row.
    const day = new Date()
    day.setUTCHours(0, 0, 0, 0)

    await prisma.browserSupportStat.upsert({
      where: { day_bucket: { day, bucket } },
      create: { day, bucket, count: 1 },
      update: { count: { increment: 1 } },
    })
  } catch {
    // A telemetry write is never worth failing a request over.
  }

  return ok
}
