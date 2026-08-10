'use client'

import { useEffect, useState } from 'react'
import { relativeTime } from '@/lib/types'
import { stateLabel } from '@/lib/states'
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
 * Hence the threshold. Below it the card leads with live activity alone —
 * "stock confirmed in Uyo, 4 minutes ago" is true on day one, is the
 * thing a patient actually cares about, and needs no scale to be
 * reassuring. Above it the counts are worth quoting and get quoted.
 *
 * Renders nothing at all until it has real data, and nothing ever if the
 * request fails. An empty space beats a confident placeholder.
 */

/**
 * Below this many approved pharmacies, a coverage count discourages more
 * than it reassures, so the card shows activity instead. Raising it is a
 * presentation choice; lowering it below the truth is not available,
 * because the number shown is always the counted one.
 */
const MIN_PHARMACIES_TO_QUOTE = 8

type Stats = {
  pharmacies: number
  states: number
  drugs: number
  lastConfirmed: { at: string; lga: string | null; state: string } | null
}

/** How often the counts are re-read. Often enough that a shop confirming
 *  stock shows up while somebody is still on the page; rare enough that an
 *  open tab is not a load generator. */
const REFRESH_MS = 45_000

/** The "4 minutes ago" has to age even when the numbers have not. */
const TICK_MS = 30_000

export default function NetworkPulse() {
  const [stats, setStats] = useState<Stats | null>(null)
  // Bumped on a timer purely to re-run relativeTime — the value is never
  // read, which is the point: without it the card silently freezes at
  // whatever "just now" meant when the page loaded.
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // no-store, or the refresh is theatre: the route sets
        // stale-while-revalidate for the edge and the browser honours it
        // too, so every poll after the first came from cache and the
        // numbers never moved. The edge cache still bounds the load.
        const res = await fetch('/api/network-stats', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch {
        /* offline, or the route is down — the card simply doesn't appear */
      }
    }
    // Deferred a tick so it never competes with the search box for the
    // first paint — this is reassurance, the search is the point.
    const timer = setTimeout(load, 0)
    const refresh = setInterval(load, REFRESH_MS)
    const tick = setInterval(() => setTick((t) => t + 1), TICK_MS)

    // Nothing to refresh for a tab nobody is looking at, and coming back
    // to a stale number is exactly when a fresh one matters.
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimeout(timer)
      clearInterval(refresh)
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!stats) return null

  const quoteCounts = stats.pharmacies >= MIN_PHARMACIES_TO_QUOTE
  const activity = stats.lastConfirmed
  if (!quoteCounts && !activity) return null

  return (
    <div className="animate-float absolute -bottom-1 left-0 w-64 select-none rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:left-2 sm:w-72 dark:border-emerald-900/60 dark:bg-gray-900/95">
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
