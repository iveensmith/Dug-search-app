import { NextRequest, NextResponse } from 'next/server'
import { consumeWindow } from '@/lib/rateLimit'
import { clientIp } from '@/lib/loginThrottle'

/**
 * One ceiling for the public read endpoints — search, suggestions, drug
 * lookups, the network counters.
 *
 * These are the app. Nobody signs in to use them, so the only handle is
 * the caller's address, and that handle is weaker here than it looks:
 * MTN, Airtel and Glo all run carrier-grade NAT, so a large number of
 * Nigerian subscribers share one public IP. A limit tuned to "what one
 * person could plausibly do" would not throttle a scraper — it would
 * throttle a carrier.
 *
 * So the number is deliberately high. It exists to stop someone pulling
 * the whole drug and pharmacy list in a loop, and to keep a runaway
 * client off the database; it is not trying to be clever about who is
 * behind an address. Locking a patient out of a medicine search is a
 * worse outcome than being scraped.
 *
 * For scale: the suggestion box debounces at 250ms, so a person typing a
 * long drug name spends five or six requests on it. 600 in five minutes
 * is two per second sustained, which no human reaches and which a scraper
 * passes immediately.
 */
const MAX_REQUESTS = 600
const WINDOW_MS = 5 * 60 * 1000

/**
 * Returns a 429 to send back, or null to carry on.
 *
 * `bucket` keeps the endpoints on separate counters, so hammering search
 * does not lock someone out of the suggestion box on the same page.
 */
export async function limitPublicRead(
  req: NextRequest,
  bucket: string,
): Promise<NextResponse | null> {
  const verdict = await consumeWindow(`${bucket}:${clientIp(req)}`, MAX_REQUESTS, WINDOW_MS)
  if (verdict.allowed) return null
  return NextResponse.json(
    { error: 'Too many requests — try again in a moment' },
    { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
  )
}
