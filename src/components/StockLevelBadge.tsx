import { stockLevel } from '@/lib/stockLevels'

/**
 * How much of a drug a pharmacy says it has.
 *
 * Renders nothing when the pharmacy has not said, which is the common case
 * and the honest one — "In stock" on its own is what the listing has
 * always meant, and inventing a band for it would be worse than silence.
 *
 * The tones do not follow the app's usual green/amber/red. "Last few" is
 * not a warning about the pharmacy, it is useful information about the
 * shelf, and colouring it like an error would push patients away from a
 * shop that is being more honest than one saying nothing at all.
 */
const TONE = {
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  urgent: 'bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300',
} as const

export default function StockLevelBadge({ level }: { level: string | null | undefined }) {
  const l = stockLevel(level)
  if (!l) return null

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[l.tone]}`}
    >
      {l.patientLabel}
    </span>
  )
}
