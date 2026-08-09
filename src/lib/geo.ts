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
  stockLevel: string | null
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
      i."stockLevel",
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
        -- Withheld until MIN_RATINGS_TO_SCORE ratings exist — see
        -- lib/ratings.ts. ::float8 matters: an uncast AVG() is numeric,
        -- which Prisma hands back as a Decimal and JSON-encodes as a
        -- string, not a number.
        CASE WHEN COUNT(*) >= 3
          THEN AVG(("availability" + "service" + "pricing" + "honesty") / 4.0)::float8
        END AS "ratingAvg"
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

/**
 * The same search for several drugs at once, keeping the nearest
 * `perDrug` pharmacies for each.
 *
 * findGenericSubstitutes used to call findPharmaciesWithDrug once per
 * sibling drug — one full geo query, ratings aggregate and all, per
 * candidate. A window function partitions by drug instead, so the whole
 * thing is one round trip whatever the number of siblings.
 */
export async function findPharmaciesWithDrugs(opts: {
  drugIds: string[]
  state: NigerianStateValue
  lga?: string | null
  lat: number
  lng: number
  perDrug?: number
}): Promise<Map<string, PharmacyStockResult[]>> {
  const { drugIds, state, lga, lat, lng } = opts
  const perDrug = opts.perDrug ?? 3
  const byDrug = new Map<string, PharmacyStockResult[]>()
  if (drugIds.length === 0) return byDrug

  const rows = await prisma.$queryRaw<(PharmacyStockResult & { drugId: string })[]>`
    WITH candidates AS (
      SELECT
        i."drugId",
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
        i."stockLevel",
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
          CASE WHEN COUNT(*) >= 3
            THEN AVG(("availability" + "service" + "pricing" + "honesty") / 4.0)::float8
          END AS "ratingAvg"
        FROM "PharmacyRating"
        GROUP BY "pharmacyId"
      ) r ON r."pharmacyId" = p."id"
      WHERE
        i."drugId" IN (${Prisma.join(drugIds)})
        AND i."inStock" = true
        AND p."verificationStatus" = 'APPROVED'
        AND p."state" = ${state}::"NigerianState"
        AND ${lga ? Prisma.sql`p."lga" = ${lga}` : Prisma.sql`TRUE`}
    )
    -- Ranked in a second level because a window function cannot reference
    -- a select-list alias from its own level. The columns are listed rather
    -- than SELECT *-ed so "rn" stays out of the result: ROW_NUMBER() is a
    -- bigint, and JSON.stringify throws on those.
    SELECT
      "drugId", "id", "name", "address", "lga", "latitude", "longitude", "phone",
      "open24h", "opensAt", "closesAt", "stockUpdatedAt", "stockLevel", "ratingCount", "ratingAvg",
      "distanceKm"
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY "drugId" ORDER BY "distanceKm" ASC) AS rn
      FROM candidates
    ) ranked
    WHERE rn <= ${perDrug}
    ORDER BY "drugId", "distanceKm" ASC
  `

  for (const row of rows) {
    const { drugId, ...result } = row
    const list = byDrug.get(drugId)
    if (list) list.push(result as PharmacyStockResult)
    else byDrug.set(drugId, [result as PharmacyStockResult])
  }
  return byDrug
}

export type SubstituteGroup = { drug: DrugSuggestion; results: PharmacyStockResult[] }

/**
 * Called only when a search for one Drug row comes back empty. Looks at
 * sibling Drug rows sharing the same genericName (different strength/form —
 * e.g. searched "Amoxicillin 500mg capsule", nothing nearby, but 250mg is
 * stocked) and returns whichever ones actually have stock nearby. One
 * batched query covers every sibling, not one query each.
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

  // Ordered, where it used to be whatever the database happened to return:
  // the old loop stopped at the first three siblings that had stock, so an
  // unordered read made the suggestions vary between identical searches.
  // Bounded too — this list feeds an IN clause.
  const siblings = await prisma.drug.findMany({
    where: { genericName, id: { not: excludeDrugId } },
    orderBy: [{ strength: 'asc' }, { form: 'asc' }],
    take: 20,
  })
  if (siblings.length === 0) return []

  const resultsByDrug = await findPharmaciesWithDrugs({
    drugIds: siblings.map((s) => s.id),
    state,
    lga,
    lat,
    lng,
    perDrug: 3,
  })

  const groups: SubstituteGroup[] = []
  for (const sibling of siblings) {
    const results = resultsByDrug.get(sibling.id)
    if (!results || results.length === 0) continue
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
    if (groups.length >= 3) break
  }
  return groups
}
