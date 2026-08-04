// Shared shapes passed between API routes and client components

export type DrugSuggestion = {
  id: string
  genericName: string
  brandNames: string[]
  strength: string
  form: string
  packSize?: string | null
  category?: string | null
}

export type PharmacyResult = {
  id: string
  name: string
  address: string
  lga: string | null
  latitude: number
  longitude: number
  phone: string
  distanceKm: number
  stockUpdatedAt: string // ISO string over the wire
  open24h: boolean
  opensAt: string | null
  closesAt: string | null
  ratingAvg: number | null
  ratingCount: number
}

export type SubstituteGroup = {
  drug: DrugSuggestion
  results: PharmacyResult[]
}

export function drugLabel(d: DrugSuggestion): string {
  const base = `${d.genericName} ${d.strength} (${d.form.toLowerCase()})`
  return d.packSize ? `${base} · ${d.packSize}` : base
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

// An in-app route (OSRM) being displayed on the results map
export type ActiveRoute = {
  pharmacyId: string
  pharmacyName: string
  toLat: number
  toLng: number
  distanceKm: number
  durationMin: number
  coords: [number, number][] // [lat, lng] polyline
}

/** "2 hours ago" / "just now" — for stock freshness stamps. */
export function relativeTime(iso: string | Date): string {
  const then = new Date(iso).getTime()
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  const months = Math.round(days / 30)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

export type StockTone = 'fresh' | 'aging' | 'stale'

/**
 * Availability is only worth something if you know how fresh it is, so
 * stockUpdatedAt is graded rather than just printed: under an hour is
 * "fresh", under a day "aging", older than that "stale" and worth a call.
 */
export function stockFreshness(iso: string | Date): { tone: StockTone; live: boolean; label: string } {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return { tone: 'fresh', live: true, label: `Confirmed ${relativeTime(iso)}` }
  if (mins < 1440) return { tone: 'aging', live: true, label: `Confirmed ${relativeTime(iso)}` }
  return { tone: 'stale', live: false, label: `Last confirmed ${relativeTime(iso)}` }
}
