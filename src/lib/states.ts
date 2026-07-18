// Canonical list of Nigeria's 36 states + FCT, in the same order/values as
// the NigerianState Prisma enum. Coordinates are each state's capital city —
// used as the distance-sort origin when a user picks a state but hasn't
// shared (or we can't use) their precise location.

export type NigerianStateValue =
  | 'ABIA' | 'ADAMAWA' | 'AKWA_IBOM' | 'ANAMBRA' | 'BAUCHI' | 'BAYELSA'
  | 'BENUE' | 'BORNO' | 'CROSS_RIVER' | 'DELTA' | 'EBONYI' | 'EDO'
  | 'EKITI' | 'ENUGU' | 'FCT_ABUJA' | 'GOMBE' | 'IMO' | 'JIGAWA'
  | 'KADUNA' | 'KANO' | 'KATSINA' | 'KEBBI' | 'KOGI' | 'KWARA' | 'LAGOS'
  | 'NASARAWA' | 'NIGER' | 'OGUN' | 'ONDO' | 'OSUN' | 'OYO' | 'PLATEAU'
  | 'RIVERS' | 'SOKOTO' | 'TARABA' | 'YOBE' | 'ZAMFARA'

export type StateInfo = {
  value: NigerianStateValue
  label: string
  capital: string
  lat: number
  lng: number
}

export const NIGERIAN_STATES: StateInfo[] = [
  { value: 'ABIA', label: 'Abia', capital: 'Umuahia', lat: 5.532, lng: 7.486 },
  { value: 'ADAMAWA', label: 'Adamawa', capital: 'Yola', lat: 9.2035, lng: 12.4954 },
  { value: 'AKWA_IBOM', label: 'Akwa Ibom', capital: 'Uyo', lat: 5.0377, lng: 7.9128 },
  { value: 'ANAMBRA', label: 'Anambra', capital: 'Awka', lat: 6.212, lng: 7.074 },
  { value: 'BAUCHI', label: 'Bauchi', capital: 'Bauchi', lat: 10.3103, lng: 9.846 },
  { value: 'BAYELSA', label: 'Bayelsa', capital: 'Yenagoa', lat: 4.9247, lng: 6.2642 },
  { value: 'BENUE', label: 'Benue', capital: 'Makurdi', lat: 7.7322, lng: 8.5391 },
  { value: 'BORNO', label: 'Borno', capital: 'Maiduguri', lat: 11.8333, lng: 13.15 },
  { value: 'CROSS_RIVER', label: 'Cross River', capital: 'Calabar', lat: 4.9757, lng: 8.3417 },
  { value: 'DELTA', label: 'Delta', capital: 'Asaba', lat: 6.2, lng: 6.7333 },
  { value: 'EBONYI', label: 'Ebonyi', capital: 'Abakaliki', lat: 6.3249, lng: 8.1137 },
  { value: 'EDO', label: 'Edo', capital: 'Benin City', lat: 6.335, lng: 5.6037 },
  { value: 'EKITI', label: 'Ekiti', capital: 'Ado-Ekiti', lat: 7.6211, lng: 5.2214 },
  { value: 'ENUGU', label: 'Enugu', capital: 'Enugu', lat: 6.5244, lng: 7.5086 },
  { value: 'FCT_ABUJA', label: 'Federal Capital Territory', capital: 'Abuja', lat: 9.0765, lng: 7.3986 },
  { value: 'GOMBE', label: 'Gombe', capital: 'Gombe', lat: 10.2897, lng: 11.1673 },
  { value: 'IMO', label: 'Imo', capital: 'Owerri', lat: 5.484, lng: 7.0351 },
  { value: 'JIGAWA', label: 'Jigawa', capital: 'Dutse', lat: 11.7566, lng: 9.3389 },
  { value: 'KADUNA', label: 'Kaduna', capital: 'Kaduna', lat: 10.5105, lng: 7.4165 },
  { value: 'KANO', label: 'Kano', capital: 'Kano', lat: 12.0022, lng: 8.592 },
  { value: 'KATSINA', label: 'Katsina', capital: 'Katsina', lat: 12.9908, lng: 7.6018 },
  { value: 'KEBBI', label: 'Kebbi', capital: 'Birnin Kebbi', lat: 12.4539, lng: 4.1975 },
  { value: 'KOGI', label: 'Kogi', capital: 'Lokoja', lat: 7.8023, lng: 6.7333 },
  { value: 'KWARA', label: 'Kwara', capital: 'Ilorin', lat: 8.4966, lng: 4.5426 },
  { value: 'LAGOS', label: 'Lagos', capital: 'Ikeja', lat: 6.6018, lng: 3.3515 },
  { value: 'NASARAWA', label: 'Nasarawa', capital: 'Lafia', lat: 8.4933, lng: 8.5167 },
  { value: 'NIGER', label: 'Niger', capital: 'Minna', lat: 9.6139, lng: 6.5569 },
  { value: 'OGUN', label: 'Ogun', capital: 'Abeokuta', lat: 7.1475, lng: 3.3619 },
  { value: 'ONDO', label: 'Ondo', capital: 'Akure', lat: 7.2571, lng: 5.2058 },
  { value: 'OSUN', label: 'Osun', capital: 'Osogbo', lat: 7.7719, lng: 4.5561 },
  { value: 'OYO', label: 'Oyo', capital: 'Ibadan', lat: 7.3775, lng: 3.947 },
  { value: 'PLATEAU', label: 'Plateau', capital: 'Jos', lat: 9.8965, lng: 8.8583 },
  { value: 'RIVERS', label: 'Rivers', capital: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  { value: 'SOKOTO', label: 'Sokoto', capital: 'Sokoto', lat: 13.0059, lng: 5.2476 },
  { value: 'TARABA', label: 'Taraba', capital: 'Jalingo', lat: 8.8833, lng: 11.3667 },
  { value: 'YOBE', label: 'Yobe', capital: 'Damaturu', lat: 11.747, lng: 11.9608 },
  { value: 'ZAMFARA', label: 'Zamfara', capital: 'Gusau', lat: 12.1704, lng: 6.6641 },
]

const BY_VALUE = new Map(NIGERIAN_STATES.map((s) => [s.value, s]))

export function stateLabel(value: string): string {
  return BY_VALUE.get(value as NigerianStateValue)?.label ?? value
}

export function stateCenter(value: string): { lat: number; lng: number } | null {
  const s = BY_VALUE.get(value as NigerianStateValue)
  return s ? { lat: s.lat, lng: s.lng } : null
}

export function isValidState(value: string): value is NigerianStateValue {
  return BY_VALUE.has(value as NigerianStateValue)
}

/**
 * Best-effort match of a free-text state name (e.g. from Nominatim reverse
 * geocoding, which returns things like "Lagos State" or "Akwa Ibom") to our
 * enum. Used only to pre-fill a dropdown the user can still correct.
 */
export function matchStateName(freeText: string): NigerianStateValue | null {
  const normalized = freeText
    .toLowerCase()
    .replace(/state$/i, '')
    .replace(/federal capital territory|fct/i, 'fct abuja')
    .replace(/[^a-z]+/g, ' ')
    .trim()
  if (!normalized) return null

  for (const s of NIGERIAN_STATES) {
    const label = s.label.toLowerCase().replace(/[^a-z]+/g, ' ').trim()
    if (label === normalized || normalized.includes(label) || label.includes(normalized)) {
      return s.value
    }
  }
  return null
}
