/**
 * Working out which LGA a reverse-geocode result is describing.
 *
 * Split out of PatientHome so it can be tested against real response
 * shapes: the only way to check this against the live service is to
 * physically stand in each of 774 places.
 *
 * Two things made the old version give up more often than it needed to.
 *
 * It read three address fields, and OpenStreetMap files Nigerian LGAs
 * under several more — `state_district` and `municipality` both appear,
 * and in many places the only clue is the settlement in `village` or
 * `suburb`.
 *
 * And it compared names exactly. Our canonical list writes Obio/Akpor,
 * Ibadan North-East, Mkpat-Enin; OSM writes Obio-Akpor, Ibadan North
 * East, Mkpat Enin. Every one of those is the same place and none of them
 * matched, so a patient in Port Harcourt was told to pick their LGA from
 * a list of 23.
 *
 * What has not changed: an unmatched result stays null. Sending somebody
 * to the wrong LGA's pharmacies is worse than asking them one question.
 */

/** The fields OSM puts a Nigerian LGA in, best first. */
const LGA_FIELDS = [
  'county',
  'state_district',
  'municipality',
  'city_district',
  'district',
  'city',
  'town',
  'village',
  'suburb',
] as const

export type NominatimAddress = Partial<Record<(typeof LGA_FIELDS)[number], string>>

/**
 * Punctuation carries no meaning in these names, and it is exactly where
 * the two spellings disagree. Slashes, hyphens and full stops become
 * spaces so "Obio/Akpor", "Obio-Akpor" and "Obio Akpor" are one string.
 */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(local government area|local government|l\.?g\.?a\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Picks the LGA, or null when nothing is certain enough.
 *
 * `lgas` is the canonical list for the state already identified, so this
 * can never return an LGA belonging to a different state.
 */
export function pickLga(
  address: NominatimAddress | undefined,
  displayName: string | undefined,
  lgas: string[],
): string | null {
  const byNormalised = new Map(lgas.map((l) => [normalise(l), l]))

  // Fields in priority order: county is the LGA far more often than
  // `suburb` is, so a match there should win over a lucky one lower down.
  for (const field of LGA_FIELDS) {
    const value = address?.[field]
    if (typeof value !== 'string') continue
    const hit = byNormalised.get(normalise(value))
    if (hit) return hit
  }

  // Nothing in the structured fields. The full display name is a comma
  // separated trail — "Ikeja, Lagos, Nigeria" — and sometimes names the
  // LGA in a part we did not read. Whole segments only: a substring scan
  // would match "Ika" inside "Ikot Abasi" and pick the wrong place.
  if (displayName) {
    for (const segment of displayName.split(',')) {
      const hit = byNormalised.get(normalise(segment))
      if (hit) return hit
    }
  }

  return null
}
