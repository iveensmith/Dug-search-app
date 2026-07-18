// Shared shapes passed between API routes and client components

export type DrugSuggestion = {
  id: string
  genericName: string
  brandNames: string[]
  strength: string
  form: string
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
}

export function drugLabel(d: DrugSuggestion): string {
  return `${d.genericName} ${d.strength} (${d.form.toLowerCase()})`
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
