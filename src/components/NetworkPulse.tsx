'use client'

import { useEffect, useState } from 'react'
import { relativeTime } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import { IconCheck } from '@/components/ui/icons'

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
        // stale-while-revalidate for the edge, and the browser honours it
        // too — so every poll after the first was served from cache and
        // the numbers never moved. Verified by adding a pharmacy with the
        // page open and watching it stay put. The edge cache still bounds
        // how much load this can generate.
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
    const first = setTimeout(load, 0)
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
      clearTimeout(first)
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
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900/60 dark:bg-gray-900">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        Live network
      </p>

      {/* The figures at a size worth reading. Still only ever the counted
          ones — the threshold above decides whether they appear at all,
          and nothing here rounds, pads or projects. */}
      {quoteCounts && (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[
            [stats.pharmacies, stats.pharmacies === 1 ? 'pharmacy' : 'pharmacies'],
            [stats.states, stats.states === 1 ? 'state' : 'states'],
            [stats.drugs, stats.drugs === 1 ? 'medicine' : 'medicines'],
          ].map(([value, label]) => (
            <div
              key={label as string}
              className="rounded-xl bg-emerald-50 px-2 py-2.5 text-center dark:bg-emerald-500/10"
            >
              <dd className="text-xl font-bold leading-none text-emerald-800 tabular-nums dark:text-emerald-300">
                {(value as number).toLocaleString()}
              </dd>
              <dt className="mt-1 text-[11px] font-medium text-emerald-800/80 dark:text-emerald-300/80">
                {label as string}
              </dt>
            </div>
          ))}
        </dl>
      )}

      {activity && (
        <p
          className={`flex items-start gap-2 text-sm leading-snug text-gray-700 dark:text-gray-300 ${
            quoteCounts ? 'mt-3' : 'mt-2.5'
          }`}
        >
          <IconCheck
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <span>
            Stock confirmed{' '}
            <span className="font-bold text-gray-900 dark:text-gray-100">
              in {activity.lga ?? stateLabel(activity.state)}
            </span>{' '}
            {relativeTime(activity.at)}
          </span>
        </p>
      )}
    </div>
  )
}
