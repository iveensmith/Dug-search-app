'use client'

import { MIN_PHARMACIES_TO_QUOTE, useNetworkStats } from '@/lib/networkStats'
import { useCountUp } from '@/lib/useCountUp'

function Figure({ value, label }: { value: number; label: string }) {
  const { ref, value: shown } = useCountUp<HTMLElement>(value)
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="mt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] leading-tight text-terracotta-100 sm:text-xs md:text-faint">
        {label}
      </dt>
      <dd
        ref={ref}
        className="font-display text-[1.75rem] font-semibold tabular-nums tracking-[-0.03em] text-white sm:text-[2rem] md:text-[2.375rem] md:text-ink"
      >
        {shown.toLocaleString()}
      </dd>
    </div>
  )
}

/**
 * The three numbers under the headline.
 *
 * The design this follows runs a row of confident figures here — doctors,
 * years, awards. Ours are counted rather than claimed, which is why there
 * are three of them and not four: those are the three the database can
 * answer. There is no testimonial count because there are no ratings with
 * comments yet, and no "years of experience" because there are none.
 *
 * Vanishes entirely below the same threshold NetworkPulse uses. A small
 * network reassures nobody by announcing its size, and the live card over
 * the illustration still says the thing that does reassure — that a real
 * pharmacy confirmed real stock recently.
 */
export default function NetworkStatsRow() {
  const stats = useNetworkStats()
  if (!stats || stats.pharmacies < MIN_PHARMACIES_TO_QUOTE) return null

  const items = [
    {
      value: stats.pharmacies,
      label: stats.pharmacies === 1 ? 'Verified pharmacy' : 'Verified pharmacies',
    },
    { value: stats.states, label: stats.states === 1 ? 'State covered' : 'States covered' },
    { value: stats.drugs, label: stats.drugs === 1 ? 'Medicine tracked' : 'Medicines tracked' },
  ]

  return (
    // Three columns rather than a wrapping row: wrapped, the third figure
    // dropped onto its own line and cost a phone another 90px above the
    // search box, which is the one thing that must not be pushed down.
    // Light type below `md`, ink from `md` up: on a phone this sits on the
    // hero photograph, on a desktop it sits on mint. Only the `md:` halves
    // are tokens — the base ones have to stay white in both themes, and
    // --ink and --on-brand both flip. Same pairing as the copy above it.
    <dl className="animate-fade-in mt-7 grid grid-cols-3 gap-4 border-t border-white/20 pt-5 md:mt-9 md:gap-8 md:border-line md:pt-6">
      {/* Each figure counts up from zero the first time it scrolls into
          view — reversed markup so the number reads first while the list
          stays term-then-description. See useCountUp. */}
      {items.map(({ value, label }) => (
        <Figure key={label} value={value} label={label} />
      ))}
    </dl>
  )
}
