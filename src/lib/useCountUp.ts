'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Counts a number up from zero to `target` the first time the element
 * scrolls into view, then holds. Reveals the figure the way the rest of
 * the page reveals its sections — and on a page whose whole subject is
 * live counts, a figure that lands rather than just appears is worth the
 * few lines.
 *
 * Respects `prefers-reduced-motion` (jumps straight to the value) and
 * degrades to the value on the server / without IntersectionObserver.
 */
export function useCountUp<T extends HTMLElement = HTMLElement>(target: number, durationMs = 1100) {
  const ref = useRef<T | null>(null)
  const [value, setValue] = useState(target)
  const done = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node || done.current) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) {
      setValue(target)
      return
    }

    setValue(0)
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || done.current) return
        done.current = true
        io.disconnect()

        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs)
          // easeOutExpo — fast, then a long settle
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
          setValue(Math.round(eased * target))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [target, durationMs])

  return { ref, value }
}
