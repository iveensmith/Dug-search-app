import { prisma } from './db'
import type { NigerianStateValue } from './states'

export type PharmacyStockResult = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  phone: string
  distanceKm: number
  stockUpdatedAt: Date
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
  lat: number
  lng: number
  limit?: number
}): Promise<PharmacyStockResult[]> {
  const { drugId, state, lat, lng } = opts
  const limit = opts.limit ?? 20

  return prisma.$queryRaw<PharmacyStockResult[]>`
    SELECT
      p."id",
      p."name",
      p."address",
      p."latitude",
      p."longitude",
      p."phone",
      i."updatedAt" AS "stockUpdatedAt",
      2 * 6371 * asin(
        sqrt(
          power(sin(radians((p."latitude" - ${lat}) / 2)), 2) +
          cos(radians(${lat})) * cos(radians(p."latitude")) *
          power(sin(radians((p."longitude" - ${lng}) / 2)), 2)
        )
      ) AS "distanceKm"
    FROM "Pharmacy" p
    JOIN "PharmacyInventory" i ON i."pharmacyId" = p."id"
    WHERE
      i."drugId" = ${drugId}
      AND i."inStock" = true
      AND p."verificationStatus" = 'APPROVED'
      AND p."state" = ${state}::"NigerianState"
    ORDER BY "distanceKm" ASC
    LIMIT ${limit}
  `
}
