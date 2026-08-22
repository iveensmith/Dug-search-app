'use client'

import { useEffect, useState } from 'react'

/**
 * The network's real numbers, fetched once for the whole page.
 *
 * Two things on the home page quote them now — the stat row beside the
 * headline and the live card over the illustration — and each used to own
 * its own fetch, its own refresh interval and its own copy of the answer.
 * That is two requests for one payload, two clocks that drift apart, and
 * two chances for the page to show a shop count in one place and a
 * different one three inches away.
 *
 * So the request lives here instead. Subscribers share one in-flight
 * promise, one refresh timer and one cached answer; the timers start with
 * the first subscriber and stop with the last.
 */

export type NetworkStats = {
  pharmacies: number
  states: number
  drugs: number
  lastConfirmed: { at: string; lga: string | null; state: string } | null
}

/**
 * Below this many approved pharmacies, a coverage count discourages more
 * than it reassures, so the callers show activity instead. Raising it is a
 * presentation choice; lowering it below the truth is not available,
 * because the number shown is always the counted one.
 */
export const MIN_PHARMACIES_TO_QUOTE = 8

/** Often enough that a shop confirming stock shows up while somebody is
 *  still on the page; rare enough that an open tab is not a load
 *  generator. */
const REFRESH_MS = 45_000

/** The "4 minutes ago" has to age even when the numbers have not. */
const TICK_MS = 30_000

let cached: NetworkStats | null = null
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()
let stopTimers: (() => void) | null = null

function announce() {
  for (const listener of [...listeners]) listener()
}

function load(): Promise<void> {
  if (inFlight) return inFlight
  // no-store, or the refresh is theatre: the route sets
  // stale-while-revalidate for the edge and the browser honours it too, so
  // every poll after the first came from cache and the numbers never
  // moved. The edge cache still bounds the load.
  inFlight = fetch('/api/network-stats', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: NetworkStats | null) => {
      if (data) {
        cached = data
        announce()
      }
    })
    .catch(() => {
      /* offline, or the route is down — callers simply render nothing */
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

function startTimers(): () => void {
  const refresh = setInterval(load, REFRESH_MS)
  const tick = setInterval(announce, TICK_MS)
  // Nothing to refresh for a tab nobody is looking at, and coming back to
  // a stale number is exactly when a fresh one matters.
  const onVisible = () => {
    if (document.visibilityState === 'visible') load()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(refresh)
    clearInterval(tick)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

/** Null until the first answer arrives, and null forever if none does. */
export function useNetworkStats(): NetworkStats | null {
  const [, bump] = useState(0)

  useEffect(() => {
    const listener = () => bump((n) => n + 1)
    listeners.add(listener)
    if (listeners.size === 1) stopTimers = startTimers()
    // Deferred a tick so it never competes with the search box for the
    // first paint — this is reassurance, the search is the point.
    const kick = setTimeout(load, 0)
    return () => {
      clearTimeout(kick)
      listeners.delete(listener)
      if (listeners.size === 0 && stopTimers) {
        stopTimers()
        stopTimers = null
      }
    }
  }, [])

  return cached
}
