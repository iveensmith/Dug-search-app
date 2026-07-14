import { prisma } from './db'

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

const KM_PER_DEGREE_LAT = 110.574
const KM_PER_DEGREE_LNG_AT_EQUATOR = 111.32

/**
 * Core search query: approved pharmacies with the given drug in stock,
 * within radiusKm of (lat, lng), nearest first.
 *
 * Uses an indexed lat/lng bounding-box pre-filter, then exact Haversine
 * distance. To move to PostGIS later, replace this SQL with
 * ST_DWithin/ST_Distance on a geography column — callers are unaffected.
 */
export async function findPharmaciesWithDrug(opts: {
  drugId: string
  lat: number
  lng: number
  radiusKm?: number
  limit?: number
}): Promise<PharmacyStockResult[]> {
  const { drugId, lat, lng } = opts
  const radiusKm = opts.radiusKm ?? 10
  const limit = opts.limit ?? 20

  const latDelta = radiusKm / KM_PER_DEGREE_LAT
  const lngDelta =
    radiusKm / (KM_PER_DEGREE_LNG_AT_EQUATOR * Math.cos((lat * Math.PI) / 180))

  return prisma.$queryRaw<PharmacyStockResult[]>`
    SELECT * FROM (
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
        AND p."latitude"  BETWEEN ${lat - latDelta} AND ${lat + latDelta}
        AND p."longitude" BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
    ) matches
    WHERE "distanceKm" <= ${radiusKm}
    ORDER BY "distanceKm" ASC
    LIMIT ${limit}
  `
}
