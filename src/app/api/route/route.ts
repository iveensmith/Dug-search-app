import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeWindow } from '@/lib/rateLimit'
import { clientIp } from '@/lib/loginThrottle'

// Free OSRM routing over OpenStreetMap — no account, no API key.
// The public demo server is fine for one-city MVP traffic; point OSRM_URL
// at a self-hosted instance (or an OpenRouteService proxy) before scale.
const OSRM_BASE = process.env.OSRM_URL ?? 'https://router.project-osrm.org'

/**
 * Metered, because this is an open door onto somebody else's free server.
 *
 * No key is needed to call it, which is exactly why it needs a limit: an
 * unauthenticated endpoint that forwards to a shared public service can be
 * used to run traffic through us, and the demo server blocks the sender —
 * meaning directions stop working for every patient. The same reasoning
 * put a cap on /api/geocode.
 *
 * A patient drawing routes to a handful of pharmacies stays well inside
 * this; nothing that looks like a person hits 30 in a minute.
 */
const MAX_REQUESTS = 30
const WINDOW_MS = 60 * 1000

const paramsSchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
})

export async function GET(req: NextRequest) {
  const verdict = await consumeWindow(`route:${clientIp(req)}`, MAX_REQUESTS, WINDOW_MS)
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: 'Too many route requests — try again in a moment' },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
    )
  }

  const parsed = paramsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }
  const { fromLat, fromLng, toLat, toLng } = parsed.data

  const url =
    `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`
  try {
    // one retry — the demo server occasionally drops a cold handshake
    let res: Response | null = null
    for (let attempt = 0; attempt < 2 && !res?.ok; attempt++) {
      res = await fetch(url, {
        headers: { 'User-Agent': 'MediQuest/0.1 (MVP; drug availability app)' },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)
    }
    if (!res?.ok) throw new Error('OSRM unreachable')
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return NextResponse.json({ error: 'No route found' }, { status: 404 })

    return NextResponse.json({
      distanceKm: route.distance / 1000,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      // GeoJSON is [lng, lat]; Leaflet wants [lat, lng]
      coords: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
    })
  } catch {
    return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })
  }
}
