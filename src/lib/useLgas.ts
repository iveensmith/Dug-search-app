'use client'

/**
 * Loads the LGA list for a state, off the critical path.
 *
 * All 774 Nigerian LGAs are a big block of text — the largest single thing
 * the patient home page used to ship, and none of it means anything until
 * a state is chosen. Importing it here instead of at the top of a page
 * moves it out of the bundle that stands between someone and the search
 * box, and fetches it the moment a state actually exists.
 *
 * The import is memoised at module scope, so three components asking for
 * three different states still cost one download.
 */

import { useEffect, useState } from 'react'

let pending: Promise<typeof import('@/lib/lgas')> | null = null

export function loadLgas() {
  pending ??= import('@/lib/lgas')
  return pending
}

/** `[]` until the list arrives — callers show a placeholder for that beat. */
export function useLgas(state: string | null | undefined): string[] {
  // Keyed by the state it was loaded for, so switching states never shows
  // the previous state's areas for a frame.
  const [loaded, setLoaded] = useState<{ state: string; lgas: string[] } | null>(null)

  useEffect(() => {
    if (!state) return
    let alive = true
    void loadLgas().then((m) => {
      if (alive) setLoaded({ state, lgas: m.lgasForState(state) })
    })
    return () => {
      alive = false
    }
  }, [state])

  return loaded && loaded.state === state ? loaded.lgas : []
}
