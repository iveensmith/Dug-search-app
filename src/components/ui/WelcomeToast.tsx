'use client'

import { useEffect, useState } from 'react'

const KEY = 'df_welcome_name'

/** Set by the login form right before redirecting; shown once on whichever
 *  page the user lands on, then cleared — never reappears on refresh/nav. */
export function setWelcomeName(name: string | null | undefined) {
  if (name) sessionStorage.setItem(KEY, name.split(' ')[0])
}

export default function WelcomeToast() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(KEY)
    if (!stored) return
    sessionStorage.removeItem(KEY)
    // Syncing from a one-shot browser storage flag set just before this page
    // loaded — not derived from any prop/state, so there's no render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(stored)
    const timer = setTimeout(() => setName(null), 4000)
    return () => clearTimeout(timer)
  }, [])

  if (!name) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[2000] flex justify-center px-4 sm:top-4">
      <div className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-emerald-500 dark:text-emerald-950">
        Welcome back, {name}!
      </div>
    </div>
  )
}
