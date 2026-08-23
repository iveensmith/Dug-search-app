import { stockFreshness } from '@/lib/types'

const TONES = {
  fresh: 'bg-brand-soft text-brand-ink',
  aging: 'bg-warn-soft text-warn-ink',
  // text-muted, not text-faint. Muted is the point of this tone — a claim
  // nobody has confirmed in a while should not shout — but the lighter of
  // the two measures 4.70:1 on this fill against text-muted's 6.14:1, and
  // "we are not sure this is still true" is not information to hide from
  // someone who cannot read low-contrast text. It still reads as the
  // quiet one next to the brand and warn tones.
  stale: 'bg-sunken text-muted',
} as const

const DOTS = {
  fresh: 'bg-ok',
  aging: 'bg-warn',
  stale: 'bg-line-strong',
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
      <span className="inline-flex items-center gap-2 rounded-full bg-danger-soft py-1.5 pl-2.5 pr-3 text-xs font-bold text-danger-ink">
        <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
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
