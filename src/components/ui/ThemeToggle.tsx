'use client'

import { useEffect, useState } from 'react'
import { IconMoon, IconSun } from '@/components/ui/icons'

type Theme = 'light' | 'dark'

function storedTheme(): Theme | null {
  const v = localStorage.getItem('theme')
  return v === 'light' || v === 'dark' ? v : null
}

/** Sun/moon switch — reflects + persists the theme the blocking script in
 *  layout.tsx already applied via [data-theme] on <html>. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // Syncs from the DOM attribute the blocking layout.tsx script already
    // set pre-hydration — not derivable from props/state, so this one-time
    // read-and-set is the correct use of an effect here.
    const applied = document.documentElement.getAttribute('data-theme')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(applied === 'dark' ? 'dark' : 'light')

    if (storedTheme()) return // user already chose explicitly — ignore OS changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      setTheme(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`cursor-pointer rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 ${className}`}
    >
      {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
    </button>
  )
}
