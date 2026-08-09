import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { findPharmaciesStockingAny } from '@/lib/geo'
import { isValidState, stateCenter } from '@/lib/states'
import { isValidLga } from '@/lib/lgas'
import { MAX_DRUGS } from '@/lib/searchLimits'

/**
 * One trip, several medicines: which nearby pharmacies cover the most of a
 * list.
 *
 * Separate from /api/search rather than a mode of it, because the answer
 * is a different shape — a pharmacy with a coverage score, not a ranked
 * list per drug — and folding both into one response would leave every
 * caller unpicking which half it got.
 */

const paramsSchema = z.object({
  drugIds: z
    .string()
    .min(1)
    .transform((v) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))])
    .refine((v) => v.length >= 1 && v.length <= MAX_DRUGS, {
      message: `Between 1 and ${MAX_DRUGS} medicines`,
    }),
  state: z.string().refine(isValidState, { message: 'Unknown state' }),
  lga: z.string().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
})

export async function GET(req: NextRequest) {
  // Same gate as the single-drug search: this is a patient tool, and an
  // owner account has its own dashboard for stock questions.
  const session = await getSession(req)
  if (session?.role === 'PHARMACY_OWNER') {
    return NextResponse.json(
      { error: 'Drug search is not available on a pharmacy owner account' },
      { status: 403 },
    )
  }

  const parsed = paramsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 })
  }
  const { drugIds, state, lat, lng } = parsed.data
  const lga = parsed.data.lga && isValidLga(state, parsed.data.lga) ? parsed.data.lga : null

  const fallback = stateCenter(state)!
  const searchLat = lat ?? fallback.lat
  const searchLng = lng ?? fallback.lng

  // Resolve the ids first: the response has to name the medicines nobody
  // stocks, and an id the caller made up should not become a phantom
  // "missing" row on every result card.
  const drugs = await prisma.drug.findMany({
    where: { id: { in: drugIds } },
    select: {
      id: true,
      genericName: true,
      brandNames: true,
      strength: true,
      form: true,
      packSize: true,
      category: true,
      dispensing: true,
    },
  })
  if (drugs.length === 0) {
    return NextResponse.json({ error: 'None of those medicines are in our list' }, { status: 404 })
  }

  const realIds = drugs.map((d) => d.id)
  const results = await findPharmaciesStockingAny({
    drugIds: realIds,
    state,
    lga,
    lat: searchLat,
    lng: searchLng,
  })

  // One log row per medicine, exactly as a single search would have
  // written — otherwise the demand board and the gap analytics would go
  // blind to anything a patient looked for as part of a list.
  const stocked = new Set(results.flatMap((r) => r.drugIds))
  await prisma.searchLog.createMany({
    data: drugs.map((d) => ({
      drugId: d.id,
      userId: session?.userId ?? null,
      queryText: `${d.genericName} ${d.strength}`,
      state,
      lga,
      latitude: lat ?? null,
      longitude: lng ?? null,
      hadResults: stocked.has(d.id),
    })),
  })

  return NextResponse.json({ drugs, results })
}
