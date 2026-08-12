import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeWindow } from '@/lib/rateLimit'
import { clientIp } from '@/lib/loginThrottle'

/**
 * Address lookup, through this server rather than from the patient's browser.
 *
 * Nominatim needs no key, so nothing secret was ever exposed by calling it
 * directly. Two other things were, though.
 *
 * The first is the patient. "Use my location" reverse-geocodes a GPS fix
 * accurate to a few metres — where someone is standing when they look for
 * medicine. Called from the browser, that goes to a third party along with
 * the patient's IP address, on a health app whose own copy promises the
 * prescription photo is "stored privately". The coordinates deserve the
 * same care. Proxied, the third party sees this server and nothing about
 * who asked.
 *
 * The second is Nominatim's usage policy, which asks for an identifying
 * User-Agent on every call. A browser cannot set one — it is a forbidden
 * header — so every one of those requests was anonymous traffic against a
 * free service, which is how an app gets blocked.
 *
 * Only the fields the callers actually use come back. Forwarding the whole
 * upstream payload would hand the client a pile of data it has no use for,
 * and quietly make this endpoint's contract "whatever Nominatim returns".
 */

const BASE = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org'
const UA = 'MediQuest/0.1 (medicine availability app; Nigeria)'

// Nominatim asks for at most one call per second. This is per address, and
// generous enough that a person tapping around the map never notices.
const MAX_REQUESTS = 20
const WINDOW_MS = 60 * 1000

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

const searchSchema = z.object({
  q: z.string().trim().min(2).max(200),
})

async function upstream(path: string): Promise<Response | null> {
  return fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)
}

export async function GET(req: NextRequest) {
  const verdict = await consumeWindow(`geocode:${clientIp(req)}`, MAX_REQUESTS, WINDOW_MS)
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: 'Too many lookups — try again in a moment' },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
    )
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries())

  // Reverse: coordinates in, administrative area out. zoom=10 asks for
  // detail around LGA level, which is what pickLga needs.
  if ('lat' in params || 'lon' in params) {
    const parsed = reverseSchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }
    const { lat, lon } = parsed.data
    const res = await upstream(
      `/reverse?format=json&addressdetails=1&zoom=10&lat=${lat}&lon=${lon}`,
    )
    if (!res?.ok) {
      return NextResponse.json({ error: 'Address service unavailable' }, { status: 502 })
    }
    const data = await res.json().catch(() => null)
    return NextResponse.json({
      address: data?.address ?? null,
      displayName: typeof data?.display_name === 'string' ? data.display_name : null,
    })
  }

  // Forward: a typed place name in, one coordinate out.
  const parsed = searchSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a place to look up' }, { status: 400 })
  }
  const res = await upstream(
    `/search?format=json&limit=1&q=${encodeURIComponent(parsed.data.q)}`,
  )
  if (!res?.ok) {
    return NextResponse.json({ error: 'Address service unavailable' }, { status: 502 })
  }
  const data = await res.json().catch(() => null)
  const hit = Array.isArray(data) ? data[0] : null
  const lat = hit ? Number(hit.lat) : NaN
  const lng = hit ? Number(hit.lon) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ match: null })
  }
  return NextResponse.json({ match: { lat, lng } })
}
