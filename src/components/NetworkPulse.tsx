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

/**
 * Where the card sits.
 *
 * `float` overlaps the corner of the photograph it is placed over, which
 * is the whole point of it on a desktop. `inline` is an ordinary block in
 * the flow — for the phone layout, where the photograph is the entire
 * band's background and has no corner to hang off: floated there, the card
 * landed underneath the search panel and all that showed was the bottom
 * line of it poking out.
 */
type Placement = 'float' | 'inline'

const PLACEMENT: Record<Placement, string> = {
  float: 'animate-float absolute bottom-3 left-0 w-64 sm:left-2 sm:w-[19rem] md:bottom-8 md:left-auto md:right-8 md:w-[19rem]',
  inline: 'w-full',
}

type Props = {
  /**
   * Set false where something else on the same screen already prints the
   * counts — the home page's stat row does — leaving this card to say the
   * one thing that row cannot: what happened most recently.
   */
  showCounts?: boolean
  placement?: Placement
}

export default function NetworkPulse({ showCounts = true, placement = 'float' }: Props) {
  const stats = useNetworkStats()
  if (!stats) return null

  const quoteCounts = showCounts && stats.pharmacies >= MIN_PHARMACIES_TO_QUOTE
  const activity = stats.lastConfirmed
  if (!quoteCounts && !activity) return null

  return (
    <div
      className={`${PLACEMENT[placement]} select-none rounded-card border border-line bg-surface/95 p-4 shadow-sheet backdrop-blur-md`}
    >
      <p className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ok-ink">
        <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-ok" data-live="true" />
        Live network
      </p>

      {quoteCounts && (
        <div className="mt-3 flex items-start gap-2">
          <IconStore
            width={15}
            height={15}
            className="mt-0.5 shrink-0 text-faint"
          />
          <p className="text-[0.8125rem] leading-snug text-muted">
            <span className="font-semibold text-ink tabular-nums">
              {stats.pharmacies.toLocaleString()}
            </span>{' '}
            verified {stats.pharmacies === 1 ? 'pharmacy' : 'pharmacies'} across{' '}
            <span className="font-semibold text-ink tabular-nums">{stats.states}</span>{' '}
            {stats.states === 1 ? 'state' : 'states'}
          </p>
        </div>
      )}

      {activity && (
        <div className={`flex items-start gap-2 ${quoteCounts ? 'mt-2' : 'mt-3'}`}>
          <IconCheck
            width={15}
            height={15}
            className="mt-0.5 shrink-0 text-ok"
          />
          <p className="text-[0.8125rem] leading-snug text-muted">
            Stock confirmed{' '}
            <span className="font-semibold text-ink">
              in {activity.lga ?? stateLabel(activity.state)}
            </span>{' '}
            <span className="whitespace-nowrap font-mono text-[0.75rem] text-faint">
              {relativeTime(activity.at)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
