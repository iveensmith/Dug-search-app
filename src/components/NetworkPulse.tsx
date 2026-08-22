'use client'

import { relativeTime } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import { MIN_PHARMACIES_TO_QUOTE, useNetworkStats } from '@/lib/networkStats'
import { IconCheck, IconStore } from '@/components/ui/icons'

/**
 * Replaces the mocked-up "Sample — not live results" card with what the
 * network is actually doing.
 *
 * A dashed box captioned "not live results" tells a first-time visitor
 * they are looking at a prototype, which is the opposite of what the top
 * of a healthcare page is for. But the fix is not to print a bigger
 * number: the counts here come from the database on every load, and if
 * the network is small they say so by staying quiet rather than by
 * rounding up.
 *
 * Hence the threshold in lib/networkStats. Below it the card leads with
 * live activity alone — "stock confirmed in Uyo, 4 minutes ago" is true on
 * day one, is the thing a patient actually cares about, and needs no scale
 * to be reassuring. Above it the counts are worth quoting and get quoted.
 *
 * Renders nothing at all until it has real data, and nothing ever if the
 * request fails. An empty space beats a confident placeholder.
 */

type Props = {
  /**
   * Set false where something else on the same screen already prints the
   * counts — the home page's stat row does — leaving this card to say the
   * one thing that row cannot: what happened most recently.
   */
  showCounts?: boolean
}

export default function NetworkPulse({ showCounts = true }: Props) {
  const stats = useNetworkStats()
  if (!stats) return null

  const quoteCounts = showCounts && stats.pharmacies >= MIN_PHARMACIES_TO_QUOTE
  const activity = stats.lastConfirmed
  if (!quoteCounts && !activity) return null

  return (
    <div className="animate-float absolute -bottom-1 left-0 w-64 select-none rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:left-2 sm:w-80 md:-left-4 dark:border-emerald-900/60 dark:bg-gray-900/95">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        Live network
      </p>

      {quoteCounts && (
        <div className="mt-2.5 flex items-start gap-2">
          <IconStore
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <p className="text-sm leading-snug text-gray-700 dark:text-gray-300">
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {stats.pharmacies.toLocaleString()}
            </span>{' '}
            verified {stats.pharmacies === 1 ? 'pharmacy' : 'pharmacies'} across{' '}
            <span className="font-bold text-gray-900 dark:text-gray-100">{stats.states}</span>{' '}
            {stats.states === 1 ? 'state' : 'states'}
          </p>
        </div>
      )}

      {activity && (
        <div className={`flex items-start gap-2 ${quoteCounts ? 'mt-2' : 'mt-2.5'}`}>
          <IconCheck
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <p className="text-sm leading-snug text-gray-700 dark:text-gray-300">
            Stock confirmed{' '}
            {activity.lga ? (
              <span className="font-bold text-gray-900 dark:text-gray-100">in {activity.lga}</span>
            ) : (
              <span className="font-bold text-gray-900 dark:text-gray-100">
                in {stateLabel(activity.state)}
              </span>
            )}{' '}
            {relativeTime(activity.at)}
          </p>
        </div>
      )}
    </div>
  )
}
