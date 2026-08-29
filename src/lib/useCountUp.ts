'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Counts a number up from zero to `target` the first time the element
 * scrolls into view, then holds. Reveals the figure the way the rest of
 * the page reveals its sections — and on a page whose whole subject is
 * live counts, a figure that lands rather than just appears is worth the
 * few lines.
 *
 * Pass `once` a stable key and the count-up plays **once per browser tab**:
 * the first landing gets the animation, and every reload or return trip
 * after that shows the final number straight away. Without this the row
 * remounts on every navigation and the figures visibly reset to zero and
 * re-climb each time — which, on a row meant to read as settled fact,
 * looks like the data is churning.
 *
 * Respects `prefers-reduced-motion` (jumps straight to the value) and
 * degrades to the value on the server / without IntersectionObserver.
 */

// Fast in-tab guard for keys already animated this session — and the
// fallback when sessionStorage is unavailable (private mode, etc.).
const playedThisSession = new Set<string>()

function hasPlayed(key: string): boolean {
  if (playedThisSession.has(key)) return true
  try {
    return window.sessionStorage.getItem(`countup:${key}`) === '1'
  } catch {
    return false
  }
}

function markPlayed(key: string) {
  playedThisSession.add(key)
  try {
    window.sessionStorage.setItem(`countup:${key}`, '1')
  } catch {
    /* sessionStorage blocked — the in-memory Set still covers this tab */
  }
}

export function useCountUp<T extends HTMLElement = HTMLElement>(
  target: number,
  { durationMs = 1100, once }: { durationMs?: number; once?: string } = {},
) {
  const ref = useRef<T | null>(null)
  const [value, setValue] = useState(target)
  const done = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node || done.current) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window) || (once && hasPlayed(once))) {
      setValue(target)
      return
    }

    // Not zeroed until the row is actually in view and the climb is about
    // to start: if the observer never reports it (offscreen the whole
    // visit, a suspended tab), the figure just shows its real value rather
    // than sitting at 0 forever.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || done.current) return
        done.current = true
        io.disconnect()
        if (once) markPlayed(once)

        setValue(0)
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.max(0, Math.min(1, (now - start) / durationMs))
          // easeOutExpo — fast, then a long settle
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
          setValue(Math.max(0, Math.round(eased * target)))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [target, durationMs, once])

  return { ref, value }
}
