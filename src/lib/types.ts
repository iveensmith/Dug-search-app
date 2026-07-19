// Shared shapes passed between API routes and client components

export type DrugSuggestion = {
  id: string
  genericName: string
  brandNames: string[]
  strength: string
  form: string
  packSize?: string | null
}

export type PharmacyResult = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  phone: string
  distanceKm: number
  stockUpdatedAt: string // ISO string over the wire
  open24h: boolean
  opensAt: string | null
  closesAt: string | null
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
