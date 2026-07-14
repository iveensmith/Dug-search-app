import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Free OSRM routing over OpenStreetMap — no account, no API key.
// The public demo server is fine for one-city MVP traffic; point OSRM_URL
// at a self-hosted instance (or an OpenRouteService proxy) before scale.
const OSRM_BASE = process.env.OSRM_URL ?? 'https://router.project-osrm.org'

const paramsSchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
})

export async function GET(req: NextRequest) {
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
        headers: { 'User-Agent': 'DrugFinderUyo/0.1 (MVP; drug availability app)' },
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
