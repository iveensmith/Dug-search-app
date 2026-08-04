'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HOME_RESET_EVENT } from '@/components/ui/SiteHeader'
import {
  IconClipboardList,
  IconSearch,
  IconStore,
  IconUser,
  type IconProps,
} from '@/components/ui/icons'

type Role = 'PATIENT' | 'PHARMACY_OWNER' | 'PHARMACIST' | 'ADMIN'
type Me = { role: Role } | null

type Tab = { href: string; label: string; Icon: (p: IconProps) => React.ReactElement; badge?: number }

function tabsFor(me: Me, unread: number): Tab[] {
  if (me?.role === 'PHARMACY_OWNER') {
    return [
      { href: '/', label: 'Overview', Icon: IconStore },
      { href: '/pharmacy', label: 'Inventory', Icon: IconClipboardList },
      { href: '/account', label: 'Account', Icon: IconUser },
    ]
  }
  if (!me) {
    return [
      { href: '/', label: 'Search', Icon: IconSearch },
      { href: '/prescriptions', label: 'Ask', Icon: IconClipboardList },
      { href: '/login', label: 'Log in', Icon: IconUser },
    ]
  }
  return [
    { href: '/', label: 'Search', Icon: IconSearch },
    { href: '/prescriptions', label: 'Prescriptions', Icon: IconClipboardList, badge: unread },
    { href: '/search-history', label: 'History', Icon: IconSearch },
    { href: '/account', label: 'Account', Icon: IconUser },
  ]
}

/**
 * Mobile-only bottom navigation. Desktop keeps the top nav, so this is
 * hidden from `md` up. Role-aware for the same reason the header is: an
 * owner has no use for patient search, and a patient has no inventory.
 */
export default function TabBar() {
  const pathname = usePathname()
  const [me, setMe] = useState<Me>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const user = data.user ?? null
        setMe(user)
        // Unread pharmacist replies are the reason to come back, so they
        // earn a badge — but only patients have them.
        if (user?.role === 'PATIENT') {
          fetch('/api/prescriptions')
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
              if (cancelled || !json) return
              type Row = { unreadCount?: number }
              const total = (json.uploads ?? []).reduce(
                (sum: number, u: Row) => sum + (u.unreadCount ?? 0),
                0,
              )
              setUnread(total)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname])

  const tabs = tabsFor(me, unread)

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 border-t border-gray-200 bg-white/85 backdrop-blur-lg md:hidden dark:border-gray-800 dark:bg-gray-950/85"
    >
      <ul
        className="mx-auto grid max-w-lg px-2 pt-2"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
        }}
      >
        {tabs.map(({ href, label, Icon, badge }) => {
          const active = pathname === href
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  // Same trick the logo uses: tapping "Search" while already
                  // on "/" can't navigate, so ask the page to reset instead.
                  if (href === '/' && pathname === '/') {
                    e.preventDefault()
                    window.dispatchEvent(new CustomEvent(HOME_RESET_EVENT))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className={`flex min-h-12 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-bold transition-colors ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                }`}
              >
                <span className="relative flex">
                  <Icon width={22} height={22} strokeWidth={active ? 2.6 : 2} />
                  {badge ? (
                    <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-extrabold text-white dark:bg-emerald-500 dark:text-emerald-950">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
