'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMark } from '@/components/ui/Logo'
import { IconMenu, IconUser, IconX } from '@/components/ui/icons'

const NAV_LINKS = [
  { href: '/', label: 'Find medicine' },
  { href: '/prescriptions', label: 'Ask a pharmacist' },
  { href: '/pharmacy/register', label: 'Register your pharmacy' },
]

export default function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg">
          <LogoMark size="sm" />
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-50">PharmaFinder</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-emerald-400'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 transition-colors hover:text-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400"
          >
            <IconUser width={17} height={17} />
            Log in
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-white/10"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <IconX width={22} height={22} /> : <IconMenu width={22} height={22} />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-gray-200 px-4 pb-4 pt-2 md:hidden dark:border-gray-800">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide ${
                    pathname === link.href
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                <IconUser width={16} height={16} />
                Log in
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
