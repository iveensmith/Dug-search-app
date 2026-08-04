import { stockFreshness } from '@/lib/types'

const TONES = {
  fresh: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  aging: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  stale: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
} as const

const DOTS = {
  fresh: 'bg-emerald-500',
  aging: 'bg-amber-500',
  stale: 'bg-gray-400 dark:bg-gray-500',
} as const

/**
 * How recently a pharmacy confirmed this stock, graded rather than just
 * stated — a claim confirmed an hour ago is worth a trip, one from last
 * week is worth a phone call first. The dot only pulses while the claim is
 * still "live", so the movement itself carries the meaning.
 */
export default function StockPulse({
  stockUpdatedAt,
  outOfStock = false,
}: {
  stockUpdatedAt: string | Date
  outOfStock?: boolean
}) {
  if (outOfStock) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 py-1.5 pl-2.5 pr-3 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
        Out of stock
      </span>
    )
  }

  const { tone, live, label } = stockFreshness(stockUpdatedAt)
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3 text-xs font-bold ${TONES[tone]}`}
    >
      <span className={`pulse-dot h-2 w-2 shrink-0 rounded-full ${DOTS[tone]}`} data-live={live} />
      {label}
    </span>
  )
}
