import { type SVGProps } from 'react'

// `filled` is 0-1 — a gradient stop gives us partial stars for averages
// like 4.3 without needing two overlaid icons.
function Star({ filled, ...props }: Omit<SVGProps<SVGSVGElement>, 'fill'> & { filled: number }) {
  const id = `star-${Math.round(filled * 100)}-${props.width ?? 14}`
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${filled * 100}%`} stopColor="currentColor" />
          <stop offset={`${filled * 100}%`} stopColor="transparent" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.35 6.2 20.4l1.1-6.45-4.7-4.6 6.5-.95L12 2.5z"
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Read-only star row. `value` is 1-5; renders empty stars when null. */
export default function RatingStars({
  value,
  count,
  size = 14,
  className = '',
}: {
  value: number | null
  count?: number
  size?: number
  className?: string
}) {
  // Coerce defensively — this renders inside the search results, so a
  // surprising value (a numeric string from SQL, say) must degrade to
  // "unrated" rather than throw and blank the page. Null stays null: an
  // unrated pharmacy must not read as a score of 0.0.
  const numeric = value === null || value === undefined ? NaN : Number(value)
  const score = Number.isFinite(numeric) ? numeric : null

  // Rated, but not enough times to publish a score: say so plainly rather
  // than showing empty stars, which reads as a bad rating.
  if (score === null && (count ?? 0) > 0) {
    return (
      <span className={`text-xs text-gray-500 dark:text-gray-400 ${className}`}>
        {count} {count === 1 ? 'rating' : 'ratings'} so far — too few to score
      </span>
    )
  }

  const label = score === null ? 'Not yet rated' : `${score.toFixed(1)} out of 5`
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={label}>
      <span className="inline-flex text-amber-500 dark:text-amber-400" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} width={size} height={size} filled={Math.min(1, Math.max(0, (score ?? 0) - i))} />
        ))}
      </span>
      <span className="sr-only">{label}</span>
      {score !== null && (
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {score.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {count === 0 ? 'No ratings yet' : `(${count})`}
        </span>
      )}
    </span>
  )
}
