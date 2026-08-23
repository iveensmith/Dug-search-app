'use client'

import { useEffect } from 'react'

/**
 * Sets a flag the moment React is running.
 *
 * The old-browser check in layout.tsx used to prove the engine modern by
 * compiling a scrap of ES2018 with `new Function`. That was wrong twice
 * over: the CSP added later has no `'unsafe-eval'`, so the constructor
 * throws on *every* browser — and the check read that as "too old" and
 * showed the warning to everyone.
 *
 * Testing syntax was always the indirect version of the question anyway.
 * What actually matters is whether the bundle ran, and this is what that
 * looks like: if React mounted, it ran. No eval, nothing for a CSP to
 * object to, and it cannot be fooled by a feature that happens to be
 * present while the bundle is broken for some other reason.
 */
export default function AppAlive() {
  useEffect(() => {
    ;(window as unknown as { __mqAlive?: boolean }).__mqAlive = true
  }, [])
  return null
}
