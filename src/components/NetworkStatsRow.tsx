'use client'

import { MIN_PHARMACIES_TO_QUOTE, useNetworkStats } from '@/lib/networkStats'

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
    <dl className="animate-fade-in mt-7 grid grid-cols-3 gap-4 border-t border-emerald-200/70 pt-5 md:mt-9 md:gap-8 md:pt-6 dark:border-emerald-900/60">
      {items.map(({ value, label }) => (
        // Reversed so the figure reads first while the markup keeps the
        // order a definition list requires: term, then description.
        <div key={label} className="flex flex-col-reverse">
          <dt className="mt-1 text-[0.7rem] font-semibold leading-tight text-gray-600 sm:text-xs dark:text-gray-400">
            {label}
          </dt>
          <dd className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl dark:text-gray-50">
            {value.toLocaleString()}
          </dd>
        </div>
      ))}
    </dl>
  )
}
