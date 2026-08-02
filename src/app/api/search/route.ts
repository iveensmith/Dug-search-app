import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { findPharmaciesWithDrug, findGenericSubstitutes } from '@/lib/geo'
import { isValidState, stateCenter } from '@/lib/states'
import { isValidLga } from '@/lib/lgas'

const paramsSchema = z.object({
  drugId: z.string().min(1).optional(),
  q: z.string().max(200).default(''),
  state: z.string().refine(isValidState, { message: 'Unknown state' }),
  lga: z.string().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
})

// Pharmacy-results search, scoped to the patient's chosen state. Called with
// a drugId picked from autocomplete, or with only free text (q) when nothing
// matched — either way the search is logged so coverage gaps show up in
// admin analytics.
export async function GET(req: NextRequest) {
  // Patient search isn't for pharmacy owner accounts — they manage stock
  // from their dashboard instead (mirrors the hidden search UI on the home
  // page, so the API can't be used to sidestep it).
  const session = await getSession(req)
  if (session?.role === 'PHARMACY_OWNER') {
    return NextResponse.json(
      { error: 'Drug search is not available on a pharmacy owner account' },
      { status: 403 },
    )
  }

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 })
  }
  const { drugId, q, state, lat, lng } = parsed.data
  // Unknown LGA for the state → ignore rather than error, so stale links
  // still search the whole state.
  const lga = parsed.data.lga && isValidLga(state, parsed.data.lga) ? parsed.data.lga : null

  const fallback = stateCenter(state)!
  const searchLat = lat ?? fallback.lat
  const searchLng = lng ?? fallback.lng

  const results = drugId
    ? await findPharmaciesWithDrug({ drugId, state, lga, lat: searchLat, lng: searchLng })
    : []

  // Nothing in the chosen LGA — widen to the whole state so the empty
  // state can still say "the nearest one that has it is X km away".
  let elsewhere: typeof results = []
  if (drugId && lga && results.length === 0) {
    elsewhere = await findPharmaciesWithDrug({
      drugId,
      state,
      lat: searchLat,
      lng: searchLng,
      limit: 3,
    })
  }

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
        lga,
        lat: searchLat,
        lng: searchLng,
      })
    }
  }

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

  return NextResponse.json({ results, substitutes, elsewhere })
}
