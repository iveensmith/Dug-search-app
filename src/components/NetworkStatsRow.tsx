'use client'

import { MIN_PHARMACIES_TO_QUOTE, useNetworkStats } from '@/lib/networkStats'
import { useCountUp } from '@/lib/useCountUp'

function Figure({ value, label, countKey }: { value: number; label: string; countKey: string }) {
  const { ref, value: shown } = useCountUp<HTMLElement>(value, { once: countKey })
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="mt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] leading-tight text-faint sm:text-xs">
        {label}
      </dt>
      <dd
        ref={ref}
        className="font-display text-[1.75rem] font-semibold tabular-nums tracking-[-0.03em] text-ink sm:text-[2rem] md:text-[2.375rem]"
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
 * Each figure counts up from zero — but only on the first landing in a
 * tab (the `once` key on useCountUp). The row remounts on every
 * navigation, and re-running the climb every time made a steady database
 * look like it kept resetting; after the first play the numbers are just
 * there.
 *
 * Vanishes entirely below MIN_PHARMACIES_TO_QUOTE. A small network
 * reassures nobody by announcing its size, and the "Live on the network"
 * section still says the thing that does reassure — that real pharmacies
 * confirmed real stock recently.
 */
export default function NetworkStatsRow() {
  const stats = useNetworkStats()
  if (!stats || stats.pharmacies < MIN_PHARMACIES_TO_QUOTE) return null

  const items = [
    {
      key: 'pharmacies',
      value: stats.pharmacies,
      label: stats.pharmacies === 1 ? 'Verified pharmacy' : 'Verified pharmacies',
    },
    {
      key: 'states',
      value: stats.states,
      label: stats.states === 1 ? 'State covered' : 'States covered',
    },
    {
      key: 'drugs',
      value: stats.drugs,
      label: stats.drugs === 1 ? 'Medicine tracked' : 'Medicines tracked',
    },
  ]

  return (
    // Three columns rather than a wrapping row: wrapped, the third figure
    // dropped onto its own line and cost a phone another 90px above the
    // search box, which is the one thing that must not be pushed down.
    <dl className="animate-fade-in mt-7 grid grid-cols-3 gap-4 border-t border-line pt-5 md:mt-9 md:gap-8 md:pt-6">
      {/* Reversed markup so the number reads first while the list stays
          term-then-description. */}
      {items.map(({ key, value, label }) => (
        <Figure key={key} countKey={`netstat:${key}`} value={value} label={label} />
      ))}
    </dl>
  )
}
