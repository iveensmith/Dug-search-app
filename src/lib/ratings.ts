// The four things patients judge a pharmacy on. Shared by the rating form,
// the summary display and the owner's dashboard so the wording never drifts.
// The `key` of each dimension is also its column name on PharmacyRating.
// Wording can change here without touching the database, and it has —
// these are labels, not keys.
export const RATING_DIMENSIONS = [
  {
    key: 'availability',
    // Was "Drug availability", which asked whether they happened to have
    // it — mostly luck, and not really the pharmacy's doing. What matters
    // on this app is whether the listing that sent someone across town
    // was true, which is a thing a pharmacy controls.
    label: 'Stock transparency',
    hint: 'Was what they listed here actually there?',
  },
  { key: 'service', label: 'Service', hint: 'Speed and helpfulness of the staff' },
  {
    key: 'pricing',
    // "Cost" invited a score for being expensive. The useful question is
    // how the price compared with everywhere else nearby.
    label: 'Relative affordability',
    hint: 'Fair price compared with other pharmacies nearby?',
  },
  { key: 'honesty', label: 'Honesty', hint: 'Genuine drugs and straight answers' },
] as const

export type RatingKey = (typeof RATING_DIMENSIONS)[number]['key']

export type RatingScores = Record<RatingKey, number>

/**
 * A public score needs at least this many ratings behind it. With one or
 * two, a single unhappy visit reads as "1.0 out of 5" on every search
 * result — unfair to a new pharmacy and misleading to patients. Below the
 * threshold we show the count and no score; owners still see their own
 * real average on their dashboard.
 */
export const MIN_RATINGS_TO_SCORE = 3

export type RatingSummary = {
  count: number
  overall: number | null // mean of the four averages, 1-5
  averages: RatingScores | null
  scored: boolean // has enough ratings to show publicly
}

/** Averages of each dimension plus an overall mean, from raw rating rows. */
/**
 * Builds a summary from counts and averages the database already worked
 * out. Preferred over summarise() for anything a patient can open: a
 * pharmacy's rating count only grows, and reading every row into the app
 * to average it is a page load that gets slower for the pharmacies people
 * use most.
 */
export function summariseAggregate(
  count: number,
  avg: Partial<Record<RatingKey, number | null>>,
): RatingSummary {
  if (count === 0) return { count: 0, overall: null, averages: null, scored: false }
  const averages = {} as RatingScores
  for (const { key } of RATING_DIMENSIONS) averages[key] = avg[key] ?? 0
  const overall =
    RATING_DIMENSIONS.reduce((sum, { key }) => sum + averages[key], 0) / RATING_DIMENSIONS.length
  return { count, overall, averages, scored: count >= MIN_RATINGS_TO_SCORE }
}

/** In-memory version, for callers that already hold the rows. */
export function summarise(rows: RatingScores[]): RatingSummary {
  if (rows.length === 0) return { count: 0, overall: null, averages: null, scored: false }
  const averages = {} as RatingScores
  for (const { key } of RATING_DIMENSIONS) {
    averages[key] = rows.reduce((sum, r) => sum + r[key], 0) / rows.length
  }
  const overall =
    RATING_DIMENSIONS.reduce((sum, { key }) => sum + averages[key], 0) / RATING_DIMENSIONS.length
  return { count: rows.length, overall, averages, scored: rows.length >= MIN_RATINGS_TO_SCORE }
}
