'use client'

import { useEffect } from 'react'

/**
 * Reveals `.reveal` / `.reveal-stagger` elements as they scroll into view.
 *
 * One IntersectionObserver for the whole page. It adds `.is-shown` when an
 * element crosses into the lower part of the viewport, then stops watching
 * it — the reveal is a one-time arrival, not a state that toggles back as
 * you scroll up.
 *
 * A MutationObserver picks up sections added later (the home page swaps
 * its whole marketing fragment out during a search and back on reset), so
 * they animate the same way the second time.
 *
 * The CSS that hides the pre-reveal state lives behind `.reveal-ready` on
 * <html>, added here — so with JS disabled or broken, every section is
 * simply visible.
 */
export default function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return

    const root = document.documentElement

    // Anything already on screen when the page loads is shown straight
    // away (it still transitions in, which reads as a load reveal) — so
    // adding `.reveal-ready` a beat after first paint never blanks
    // content the visitor is already looking at. Only below-fold sections
    // get held back for the scroll.
    for (const el of document.querySelectorAll('.reveal, .reveal-stagger')) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
        el.classList.add('is-shown')
      }
    }
    root.classList.add('reveal-ready')

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-shown')
          io.unobserve(entry.target)
        }
      },
      // Fire a little before the element is fully in — its top needs to be
      // up past the bottom 12% of the viewport.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    )

    const watched = new WeakSet<Element>()
    const scan = () => {
      for (const el of document.querySelectorAll('.reveal, .reveal-stagger')) {
        if (watched.has(el) || el.classList.contains('is-shown')) continue
        watched.add(el)
        io.observe(el)
      }
    }

    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
      root.classList.remove('reveal-ready')
    }
  }, [])

  return null
}
