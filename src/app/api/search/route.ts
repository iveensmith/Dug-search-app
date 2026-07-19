import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { findPharmaciesWithDrug, findGenericSubstitutes } from '@/lib/geo'
import { isValidState, stateCenter } from '@/lib/states'

const paramsSchema = z.object({
  drugId: z.string().min(1).optional(),
  q: z.string().max(200).default(''),
  state: z.string().refine(isValidState, { message: 'Unknown state' }),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
})

// Pharmacy-results search, scoped to the patient's chosen state. Called with
// a drugId picked from autocomplete, or with only free text (q) when nothing
// matched — either way the search is logged so coverage gaps show up in
// admin analytics.
export async function GET(req: NextRequest) {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 })
  }
  const { drugId, q, state, lat, lng } = parsed.data

  const fallback = stateCenter(state)!
  const searchLat = lat ?? fallback.lat
  const searchLng = lng ?? fallback.lng

  const results = drugId
    ? await findPharmaciesWithDrug({ drugId, state, lat: searchLat, lng: searchLng })
    : []

  // Zero results for a real drug (not free-text) — check whether nearby
  // pharmacies stock a different strength/form of the same generic before
  // giving up entirely.
  let substitutes: Awaited<ReturnType<typeof findGenericSubstitutes>> = []
  if (drugId && results.length === 0) {
    const drug = await prisma.drug.findUnique({ where: { id: drugId }, select: { genericName: true } })
    if (drug) {
      substitutes = await findGenericSubstitutes({
        genericName: drug.genericName,
        excludeDrugId: drugId,
        state,
        lat: searchLat,
        lng: searchLng,
      })
    }
  }

  const session = await getSession(req)

  await prisma.searchLog.create({
    data: {
      drugId: drugId ?? null,
      userId: session?.userId ?? null,
      queryText: q,
      state,
      latitude: lat ?? null, // log only real user locations, not the fallback
      longitude: lng ?? null,
      hadResults: results.length > 0,
    },
  })

  return NextResponse.json({ results, substitutes })
}
