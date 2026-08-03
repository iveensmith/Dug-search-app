import { Prisma } from '../generated/prisma/client'
import { prisma } from './db'
import type { NigerianStateValue } from './states'
import type { DrugSuggestion } from './types'

export type PharmacyStockResult = {
  id: string
  name: string
  address: string
  lga: string | null
  latitude: number
  longitude: number
  phone: string
  distanceKm: number
  stockUpdatedAt: Date
  open24h: boolean
  opensAt: string | null
  closesAt: string | null
  ratingAvg: number | null // mean of the four rated dimensions, null when unrated
  ratingCount: number
}

/**
 * Core search query: approved pharmacies IN THE GIVEN STATE with the given
 * drug in stock, nearest-first to (lat, lng) — which is either the user's
 * real location or their state's capital as a fallback. State is the scope
 * boundary now (not a radius): Nigeria's states are themselves bigger than
 * any sane search radius, so there's no separate distance cutoff to apply.
 */
export async function findPharmaciesWithDrug(opts: {
  drugId: string
  state: NigerianStateValue
  lga?: string | null // optional narrowing within the state
  lat: number
  lng: number
  limit?: number
}): Promise<PharmacyStockResult[]> {
  const { drugId, state, lga, lat, lng } = opts
  const limit = opts.limit ?? 20

  return prisma.$queryRaw<PharmacyStockResult[]>`
    SELECT
      p."id",
      p."name",
      p."address",
      p."lga",
      p."latitude",
      p."longitude",
      p."phone",
      p."open24h",
      p."opensAt",
      p."closesAt",
      i."updatedAt" AS "stockUpdatedAt",
      COALESCE(r."ratingCount", 0)::int AS "ratingCount",
      r."ratingAvg",
      2 * 6371 * asin(
        sqrt(
          power(sin(radians((p."latitude" - ${lat}) / 2)), 2) +
          cos(radians(${lat})) * cos(radians(p."latitude")) *
          power(sin(radians((p."longitude" - ${lng}) / 2)), 2)
        )
      ) AS "distanceKm"
    FROM "Pharmacy" p
    JOIN "PharmacyInventory" i ON i."pharmacyId" = p."id"
    LEFT JOIN (
      SELECT
        "pharmacyId",
        COUNT(*) AS "ratingCount",
        AVG(("availability" + "service" + "pricing" + "honesty") / 4.0) AS "ratingAvg"
      FROM "PharmacyRating"
      GROUP BY "pharmacyId"
    ) r ON r."pharmacyId" = p."id"
    WHERE
      i."drugId" = ${drugId}
      AND i."inStock" = true
      AND p."verificationStatus" = 'APPROVED'
      AND p."state" = ${state}::"NigerianState"
      AND ${lga ? Prisma.sql`p."lga" = ${lga}` : Prisma.sql`TRUE`}
    ORDER BY "distanceKm" ASC
    LIMIT ${limit}
  `
}

export type SubstituteGroup = { drug: DrugSuggestion; results: PharmacyStockResult[] }

/**
 * Called only when a search for one Drug row comes back empty. Looks at
 * sibling Drug rows sharing the same genericName (different strength/form —
 * e.g. searched "Amoxicillin 500mg capsule", nothing nearby, but 250mg is
 * stocked) and returns whichever ones actually have stock nearby. Small
 * candidate count at this app's scale, so a query-per-sibling is simpler
 * than one fancier batched query and easy to reason about.
 */
export async function findGenericSubstitutes(opts: {
  genericName: string
  excludeDrugId: string
  state: NigerianStateValue
  lga?: string | null
  lat: number
  lng: number
}): Promise<SubstituteGroup[]> {
  const { genericName, excludeDrugId, state, lga, lat, lng } = opts

  const siblings = await prisma.drug.findMany({
    where: { genericName, id: { not: excludeDrugId } },
  })
  if (siblings.length === 0) return []

  const groups: SubstituteGroup[] = []
  for (const sibling of siblings) {
    const results = await findPharmaciesWithDrug({ drugId: sibling.id, state, lga, lat, lng, limit: 3 })
    if (results.length > 0) {
      groups.push({
        drug: {
          id: sibling.id,
          genericName: sibling.genericName,
          brandNames: sibling.brandNames,
          strength: sibling.strength,
          form: sibling.form,
          packSize: sibling.packSize,
        },
        results,
      })
    }
    if (groups.length >= 3) break
  }
  return groups
}
