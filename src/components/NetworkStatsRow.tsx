'use client'

import { MIN_PHARMACIES_TO_QUOTE, useNetworkStats } from '@/lib/networkStats'

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="mt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] leading-tight text-faint sm:text-xs">
        {label}
      </dt>
      <dd className="font-display text-[1.75rem] font-semibold tabular-nums tracking-[-0.03em] text-ink sm:text-[2rem] md:text-[2.375rem]">
        {value.toLocaleString()}
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
 * They render as their final value straight away. An earlier version
 * counted each one up from zero on mount, but the row remounts on every
 * navigation, so the figures visibly reset and re-climbed every time the
 * page was opened — on a row whose whole job is to read as settled fact,
 * that looked like the data was unstable. The `.intro` load cascade
 * already fades the row in; it does not need its own animation on top.
 *
 * Vanishes entirely below the same threshold NetworkPulse uses. A small
 * network reassures nobody by announcing its size, and the live "stock
 * confirmed" card still says the thing that does reassure — that a real
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
    <dl className="animate-fade-in mt-7 grid grid-cols-3 gap-4 border-t border-line pt-5 md:mt-9 md:gap-8 md:pt-6">
      {/* Reversed markup so the number reads first while the list stays
          term-then-description. */}
      {items.map(({ value, label }) => (
        <Figure key={label} value={value} label={label} />
      ))}
    </dl>
  )
}
