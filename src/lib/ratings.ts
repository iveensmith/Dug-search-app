// The four things patients judge a pharmacy on. Shared by the rating form,
// the summary display and the owner's dashboard so the wording never drifts.
export const RATING_DIMENSIONS = [
  {
    key: 'availability',
    label: 'Drug availability',
    hint: 'Did they actually have what you came for?',
  },
  { key: 'service', label: 'Service', hint: 'Speed and helpfulness of the staff' },
  { key: 'pricing', label: 'Cost', hint: 'Was the price fair?' },
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
