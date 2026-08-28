import { stockFreshness } from '@/lib/types'

const TONES = {
  fresh: 'bg-ok-soft text-ok-ink ring-1 ring-inset ring-ok/15',
  aging: 'bg-warn-soft text-warn-ink ring-1 ring-inset ring-warn/20',
  // text-muted, not text-faint. Muted is the point of this tone — a claim
  // nobody has confirmed in a while should not shout — but the lighter of
  // the two measures 4.70:1 on this fill against text-muted's 6.14:1, and
  // "we are not sure this is still true" is not information to hide from
  // someone who cannot read low-contrast text. It still reads as the
  // quiet one next to the brand and warn tones.
  stale: 'bg-sunken text-muted ring-1 ring-inset ring-line',
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft py-1 pl-2 pr-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-danger-ink ring-1 ring-inset ring-danger/20">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
        Out of stock
      </span>
    )
  }

  const { tone, live, label } = stockFreshness(stockUpdatedAt)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-[0.6875rem] font-semibold ${TONES[tone]}`}
    >
      <span
        className={`pulse-dot h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[tone]}`}
        data-live={live}
      />
      <span className="font-mono text-[0.6875rem] tracking-tight">{label}</span>
    </span>
  )
}
