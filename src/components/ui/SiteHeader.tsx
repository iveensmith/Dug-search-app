'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMark } from '@/components/ui/Logo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import WelcomeToast from '@/components/ui/WelcomeToast'
import CheckEmailBanner from '@/components/ui/CheckEmailBanner'
import { DASHBOARD_HREF, DASHBOARD_LABEL } from '@/lib/roles'
import { logout } from '@/lib/logout'
import { IconLogOut, IconMenu, IconUser, IconX } from '@/components/ui/icons'

/**
 * Clicking the logo (or "Find medicine") while already on "/" is a no-op as
 * far as the router is concerned, so the home page would keep showing search
 * results. The header fires this instead and the page resets itself to the
 * hero — cheaper and less jarring than a full reload.
 */
export const HOME_RESET_EVENT = 'mediquest:reset-home'

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Find medicine' },
  { href: '/prescriptions', label: 'Ask a pharmacist' },
  { href: '/pharmacy/register', label: 'Add your pharmacy outlet' },
]

type Role = 'PATIENT' | 'PHARMACY_OWNER' | 'PHARMACIST' | 'ADMIN'
type Me = { displayName: string | null; role: Role; hasPharmacy?: boolean } | null

export default function SiteHeader() {
  const pathname = usePathname()
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

  function handleHomeClick(e: React.MouseEvent) {
    if (pathname !== '/') return // ordinary navigation from another page
    e.preventDefault()
    setOpen(false)
    window.dispatchEvent(new CustomEvent(HOME_RESET_EVENT))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function signOut() {
    setOpen(false)
    await logout()
  }

  // Owners get a shop-keeping nav (their own dashboard, and the outlet
  // form only until they have one); everyone else gets the patient nav.
  const navLinks: { href: string; label: string }[] =
    me?.role === 'PHARMACY_OWNER'
      ? [
          { href: '/pharmacy/overview', label: 'Overview' },
          { href: '/pharmacy', label: 'My inventory' },
          ...(me.hasPharmacy ? [] : [{ href: '/pharmacy/register', label: 'Add your pharmacy outlet' }]),
        ]
      : [
          ...NAV_LINKS.filter((link) => link.href !== '/pharmacy/register' || !me),
          // Only for signed-in patients — reservations are tied to an
          // account, so the page would just bounce a signed-out visitor
          // to the login form.
          ...(me?.role === 'PATIENT' ? [{ href: '/reservations', label: 'My reservations' }] : []),
        ]

  // Owners have their own home; pointing the logo there avoids a pointless
  // hop through "/" and its redirect.
  const homeHref = me?.role === 'PHARMACY_OWNER' ? '/pharmacy/overview' : '/'

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur-sm">
      <WelcomeToast />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href={homeHref}
          onClick={handleHomeClick}
          className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg"
        >
          <LogoMark size="sm" />
          <span className="text-lg font-bold tracking-tight text-ink">MediQuest</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={link.href === '/' ? handleHomeClick : undefined}
                // Sentence case, and the current page carries a rule under
                // it. Small caps made three ordinary phrases shout, and
                // colour alone was the only thing marking which page you
                // were on — which is nothing at all to a reader who cannot
                // separate those two greens.
                className={`border-b-2 pb-0.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-brand text-brand-ink'
                    : 'border-transparent text-muted hover:text-brand-ink'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
          {!checked ? (
            <div className="h-5 w-16 animate-pulse rounded bg-sunken" />
          ) : me ? (
            <>
              <Link
                href="/account"
                className="text-sm font-semibold text-muted transition-colors hover:text-brand-ink"
              >
                {me.displayName ? `Hi, ${me.displayName.split(' ')[0]}` : DASHBOARD_LABEL[me.role]}
              </Link>
              <button
                onClick={signOut}
                className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-faint transition-colors hover:text-danger"
              >
                <IconLogOut width={16} height={16} />
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-1.5 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand-ink"
            >
              <IconUser width={17} height={17} />
              Log in
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="cursor-pointer rounded-lg p-2 text-muted hover:bg-sunken"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <IconX width={22} height={22} /> : <IconMenu width={22} height={22} />}
          </button>
        </div>
      </div>

      {me?.displayName && (
        <div className="px-4 pb-2.5 md:hidden">
          <Link
            href="/account"
            className="text-sm font-semibold text-brand-ink"
          >
            Hi, {me.displayName.split(' ')[0]} 👋
          </Link>
        </div>
      )}

      {open && (
        <nav className="animate-fade-in border-t border-line px-4 pb-4 pt-2 md:hidden">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={(e) => {
                    if (link.href === '/') handleHomeClick(e)
                    setOpen(false)
                  }}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide ${
                    pathname === link.href
                      ? 'bg-brand-soft text-brand-ink'
                      : 'text-muted'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {me ? (
              <>
                <li>
                  <Link
                    href={DASHBOARD_HREF[me.role]}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted"
                  >
                    <IconUser width={16} height={16} />
                    {DASHBOARD_LABEL[me.role]}
                  </Link>
                </li>
                <li>
                  <button
                    onClick={signOut}
                    className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-danger"
                  >
                    <IconLogOut width={16} height={16} />
                    Log out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted"
                >
                  <IconUser width={16} height={16} />
                  Log in
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
    {/* Below the sticky bar, not inside it — see AppHeader. */}
    <CheckEmailBanner />
    </>
  )
}
