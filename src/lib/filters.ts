/**
 * The filter *rules*, kept apart from the filter *sheet*.
 *
 * The results list applies filters on every render; the sheet only exists
 * once someone taps "Filters". Keeping the predicates here means a patient
 * who never opens the sheet never downloads it.
 */

import { stockFreshness, type PharmacyResult } from '@/lib/types'
import { isOpenNow } from '@/lib/hours'

export type Filters = {
  maxKm: number | null // null = any distance
  openNow: boolean
  confirmedToday: boolean
  open24h: boolean
  rated4: boolean
}

export const NO_FILTERS: Filters = {
  maxKm: null,
  openNow: false,
  confirmedToday: false,
  open24h: false,
  rated4: false,
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.maxKm === null ? 0 : 1) +
    Number(f.openNow) +
    Number(f.confirmedToday) +
    Number(f.open24h) +
    Number(f.rated4)
  )
}

/** Every predicate maps to a field the search API already returns. */
export function applyFilters(results: PharmacyResult[], f: Filters): PharmacyResult[] {
  return results.filter((r) => {
    if (f.maxKm !== null && r.distanceKm > f.maxKm) return false
    if (f.open24h && !r.open24h) return false
    if (f.openNow && isOpenNow(r) !== true) return false
    if (f.confirmedToday && stockFreshness(r.stockUpdatedAt).tone === 'stale') return false
    if (f.rated4 && (r.ratingAvg ?? 0) < 4) return false
    return true
  })
}
