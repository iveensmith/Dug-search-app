'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogoMark } from '@/components/ui/Logo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LanguageToggle from '@/components/ui/LanguageToggle'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { DictKey } from '@/lib/i18n/dictionary'
import { IconLogOut, IconMenu, IconUser, IconX } from '@/components/ui/icons'

const NAV_LINKS: { href: string; key: DictKey }[] = [
  { href: '/', key: 'nav.findMedicine' },
  { href: '/prescriptions', key: 'nav.askPharmacist' },
  { href: '/pharmacy/register', key: 'nav.addPharmacy' },
]

type Role = 'PATIENT' | 'PHARMACY_OWNER' | 'PHARMACIST' | 'ADMIN'
type Me = { displayName: string | null; role: Role } | null

const DASHBOARD_HREF: Record<Role, string> = {
  PATIENT: '/search-history',
  PHARMACY_OWNER: '/pharmacy',
  PHARMACIST: '/pharmacist',
  ADMIN: '/admin',
}
const DASHBOARD_LABEL: Record<Role, string> = {
  PATIENT: 'Search history',
  PHARMACY_OWNER: 'Pharmacy dashboard',
  PHARMACIST: 'Pharmacist desk',
  ADMIN: 'Admin panel',
}

export default function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<Me>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMe(data.user ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setMe(null)
    setOpen(false)
    router.push('/')
    router.refresh()
  }

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
                {t(link.key)}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <LanguageToggle />
          <ThemeToggle />
          {!checked ? (
            <div className="h-5 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : me ? (
            <>
              <Link
                href={DASHBOARD_HREF[me.role]}
                className="text-sm font-semibold text-gray-700 transition-colors hover:text-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400"
              >
                {me.displayName ? `Hi, ${me.displayName.split(' ')[0]}` : DASHBOARD_LABEL[me.role]}
              </Link>
              <button
                onClick={logout}
                className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              >
                <IconLogOut width={16} height={16} />
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 transition-colors hover:text-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400"
            >
              <IconUser width={17} height={17} />
              {t('nav.login')}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageToggle />
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="cursor-pointer rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <IconX width={22} height={22} /> : <IconMenu width={22} height={22} />}
          </button>
        </div>
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
                  {t(link.key)}
                </Link>
              </li>
            ))}
            {me ? (
              <>
                <li>
                  <Link
                    href={DASHBOARD_HREF[me.role]}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    <IconUser width={16} height={16} />
                    {DASHBOARD_LABEL[me.role]}
                  </Link>
                </li>
                <li>
                  <button
                    onClick={logout}
                    className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 dark:text-red-400"
                  >
                    <IconLogOut width={16} height={16} />
                    {t('nav.logout')}
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  <IconUser width={16} height={16} />
                  {t('nav.login')}
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  )
}
