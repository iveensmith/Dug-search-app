import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { findPharmaciesWithDrug } from '@/lib/geo'
import { UYO_CENTER } from '@/lib/types'

const paramsSchema = z.object({
  drugId: z.string().min(1).optional(),
  q: z.string().max(200).default(''),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(50).default(10),
})

// Pharmacy-results search. Called with a drugId picked from autocomplete, or
// with only free text (q) when nothing matched — either way the search is
// logged so coverage gaps show up in admin analytics.
export async function GET(req: NextRequest) {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 })
  }
  const { drugId, q, lat, lng, radiusKm } = parsed.data

  const searchLat = lat ?? UYO_CENTER.lat
  const searchLng = lng ?? UYO_CENTER.lng

  const results = drugId
    ? await findPharmaciesWithDrug({ drugId, lat: searchLat, lng: searchLng, radiusKm })
    : []

  await prisma.searchLog.create({
    data: {
      drugId: drugId ?? null,
      queryText: q,
      latitude: lat ?? null, // log only real user locations, not the fallback
      longitude: lng ?? null,
      hadResults: results.length > 0,
    },
  })

  return NextResponse.json({ results })
}
