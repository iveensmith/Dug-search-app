'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import type { RatingSummary } from '@/lib/ratings'
import { drugLabel, type DrugSuggestion } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import {
  IconAlertCircle,
  IconClipboardList,
  IconClock,
  IconDownload,
  IconPlus,
  IconSearch,
  IconStar,
  IconStore,
  IconUser,
  type IconProps,
} from '@/components/ui/icons'

type Pharmacy = {
  id: string
  name: string
  address: string
  state: string
  lga: string | null
  verificationStatus: string
}

const statTileClass =
  'rounded-card border border-line bg-surface p-4 text-center shadow-card sm:p-5'

type RecentSearch = { id: string; drug: DrugSuggestion | null; youStock: boolean }

type Scope = { kind: 'lga' | 'state'; label: string }

type Gap = { drug: DrugSuggestion; count: number }

const quickActionClass =
  'inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-line-brand hover:bg-brand-soft hover:text-brand-ink'

const QUICK_ACTIONS: {
  label: string
  href: string
  download?: boolean
  Icon?: (p: IconProps) => React.ReactElement
}[] = [
  { label: 'Local searches', href: '/pharmacy?tab=searches', Icon: IconSearch },
  { label: 'Update opening hours', href: '/pharmacy#hours', Icon: IconClock },
  { label: 'Download stock CSV', href: '/api/inventory/export', download: true, Icon: IconDownload },
  { label: 'Account settings', href: '/account', Icon: IconUser },
]

/**
 * The home page for a signed-in pharmacy owner. Patients get the search
 * hero; owners get their own shop at a glance — stock counts, verification
 * state, and the drugs patients in their own LGA searched for that they
 * don't stock. Built entirely from the existing dashboard endpoints.
 */
export default function OwnerHome({ displayName }: { displayName: string | null }) {
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null)
  // Counts, not rows: /api/inventory returns one page of items now, so
  // measuring its length would report twenty for a shop with hundreds.
  const [counts, setCounts] = useState<{ total: number; inStock: number } | null>(null)
  const [searches, setSearches] = useState<RecentSearch[] | null>(null)
  const [scope, setScope] = useState<Scope | null>(null)
  const [noPharmacy, setNoPharmacy] = useState(false)
  // Reported by the rating card below rather than fetched again here.
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/inventory')
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNoPharmacy(true)
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data) => {
        if (cancelled || !data) return
        setPharmacy(data.pharmacy)
        setCounts({ total: data.total ?? 0, inStock: data.inStockCount ?? 0 })
      })
      .catch(() => {})
    // Just the summary — limit=1 because the tile needs the average, not
    // the ratings themselves. The full list lives on /pharmacy/ratings.
    fetch('/api/pharmacy/ratings?limit=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setRatingSummary(data.summary ?? null)
      })
      .catch(() => {})
    fetch('/api/pharmacy/recent-searches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSearches(data.searches ?? [])
        setScope(data.scope ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Drugs patients searched for locally that this pharmacy doesn't stock,
  // most-searched first — the one thing worth acting on today.
  const gaps = useMemo<Gap[]>(() => {
    if (!searches) return []
    const byDrug = new Map<string, Gap>()
    for (const s of searches) {
      if (!s.drug || s.youStock) continue
      const existing = byDrug.get(s.drug.id)
      if (existing) existing.count += 1
      else byDrug.set(s.drug.id, { drug: s.drug, count: 1 })
    }
    return [...byDrug.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  }, [searches])

  if (noPharmacy) {
    return (
      <div className="animate-fade-up py-12">
        <Card className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <IconStore width={22} height={22} />
          </span>
          <p className="mt-3 font-semibold text-ink">
            Let&apos;s add your pharmacy
          </p>
          <p className="mt-1 text-sm text-muted">
            Register your outlet so patients searching nearby can see what you have in stock.
          </p>
          <Link
            href="/pharmacy/register"
            className="mt-4 inline-flex w-full items-center justify-center rounded-control bg-brand px-4 py-2.5 font-semibold text-on-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] transition-colors hover:bg-brand-hover"
          >
            Add your outlet
          </Link>
        </Card>
      </div>
    )
  }

  const inStock = counts?.inStock ?? 0
  const outOfStock = (counts?.total ?? 0) - inStock
  const approved = pharmacy?.verificationStatus === 'APPROVED'

  return (
    <div className="animate-fade-up">
      {/* The greeting band matches the patient hero — same paper ground,
          same hairline under it — so the two sides of the app read as one
          place seen from different accounts. */}
      <header className="border-b border-line bg-canvas">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 md:py-14">
        <p className="flex items-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-ink">
          <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
          Pharmacy dashboard
        </p>
        <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.4rem]">
          {displayName ? `Welcome back, ${displayName.split(' ')[0]}` : 'Welcome back'}
        </h1>
        {pharmacy && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-muted">
            <span className="font-medium text-ink">{pharmacy.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              {pharmacy.lga ? `${pharmacy.lga}, ` : ''}
              {stateLabel(pharmacy.state)}
            </span>
            {approved && <VerifiedBadge />}
          </p>
        )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pt-8">

      {pharmacy && !approved && (
        <div className="mt-6 flex items-start gap-3 rounded-control border border-warn bg-warn-soft p-4 text-sm text-warn-ink">
          <IconAlertCircle width={18} height={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {pharmacy.verificationStatus === 'REJECTED'
                ? 'Registration rejected'
                : 'Awaiting verification'}
            </p>
            <p className="mt-1">
              {pharmacy.verificationStatus === 'REJECTED'
                ? 'Your PCN licence could not be verified. Contact us if you think this is a mistake.'
                : "We're checking your PCN licence — usually 2–3 working days. Your pharmacy appears in patient searches once approved."}
            </p>
          </div>
        </div>
      )}

      {/* Two across on a phone, four on anything wider: four tiles side by
          side on a 390px screen leaves each about 85px, which the numbers
          outgrow as soon as a shop lists a hundred drugs. */}
      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          ['Drugs listed', counts?.total],
          ['In stock', inStock],
          ['Out of stock', outOfStock],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className={statTileClass}
          >
            <dd className="font-display text-2xl font-semibold tabular-nums tracking-[-0.02em] text-ink sm:text-3xl">
              {counts === null ? '—' : (value as number)}
            </dd>
            <dt className="mt-1 text-xs font-medium text-faint sm:text-sm">
              {label as string}
            </dt>
          </div>
        ))}

        {/* A number to glance at, nothing to click — the way through to the
            ratings is the button below, where the other actions live. */}
        <div className={statTileClass}>
          <dd className="font-display text-2xl font-semibold tabular-nums tracking-[-0.02em] text-ink sm:text-3xl">
            {ratingSummary === null || ratingSummary.count === 0
              ? '—'
              : ratingSummary.overall!.toFixed(1)}
          </dd>
          <dt className="mt-1 text-xs font-medium text-faint sm:text-sm">
            {ratingSummary && ratingSummary.count === 0 ? 'No ratings yet' : 'Rating'}
          </dt>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/pharmacy"
          className="flex flex-1 items-center justify-center gap-2 rounded-control bg-brand px-5 py-3 font-semibold text-on-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] transition-all hover:bg-brand-hover hover:shadow-brand"
        >
          <IconClipboardList width={18} height={18} />
          Manage inventory
        </Link>
        {/* ?add=1, not the bare inventory page: the two buttons pointed
            at the same URL, so "Add a drug" landed on the same list as
            "Manage inventory" with the form still closed. */}
        <Link
          href="/pharmacy?add=1"
          className="flex flex-1 items-center justify-center gap-2 rounded-control border border-brand/40 px-5 py-3 font-semibold text-brand-ink transition-colors hover:border-brand/70 hover:bg-brand-soft"
        >
          <IconPlus width={18} height={18} />
          Add a drug
        </Link>
        <Link
          href="/pharmacy/ratings"
          className="flex flex-1 items-center justify-center gap-2 rounded-control border border-brand/40 px-5 py-3 font-semibold text-brand-ink transition-colors hover:border-brand/70 hover:bg-brand-soft"
        >
          <IconStar width={18} height={18} />
          See your ratings
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.01em] text-ink">
          <IconSearch width={18} height={18} className="text-brand-ink" />
          Local demand you&apos;re missing
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {scope
            ? `Recently searched by patients in ${
                scope.kind === 'lga' ? `${scope.label} LGA` : stateLabel(scope.label)
              } — and not in your stock list.`
            : 'Recently searched by patients near you.'}
        </p>

        {searches === null ? (
          <ul className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="animate-pulse rounded-card border border-line bg-surface p-4"
              >
                <div className="h-4 w-2/5 rounded bg-line" />
              </li>
            ))}
          </ul>
        ) : gaps.length === 0 ? (
          <p className="mt-4 rounded-card border border-dashed border-line-strong p-6 text-center text-sm text-faint">
            Nothing to act on — you stock everything patients searched for recently.
          </p>
        ) : (
          <ul className="stagger mt-4 space-y-2">
            {gaps.map(({ drug, count }) => (
              // No one-tap add here on purpose: this is a list of what
              // patients asked for, not a list of what the shop has. Adding
              // from it would put a drug in the stock list without anyone
              // checking the shelf, and a false "in stock" sends a patient
              // on a wasted trip. They add it themselves from the inventory
              // page, with the brand and expiry they actually hold.
              <li key={drug.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {drugLabel(drug)}
                    </p>
                    <p className="text-xs text-faint">
                      {count} {count === 1 ? 'search' : 'searches'}{' '}
                      recently · you don&apos;t stock this
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
          Quick actions
        </p>
        {/* Each of these has to land somewhere specific. They all used to
            point at bare /pharmacy, which drops you on the inventory tab and
            leaves you to find the thing yourself. "?tab=" picks the tab on
            arrival; "#hours" scrolls to the hours card once the dashboard
            data has loaded, since it doesn't exist before that. */}
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, href, download, Icon }) =>
            download ? (
              // A real download, so a plain anchor: the export route sends
              // Content-Disposition: attachment, and routing through <Link>
              // would try to navigate to a CSV instead of saving it.
              <a key={label} href={href} className={quickActionClass}>
                {Icon && <Icon width={13} height={13} />}
                {label}
              </a>
            ) : (
              <Link key={label} href={href} className={quickActionClass}>
                {Icon && <Icon width={13} height={13} />}
                {label}
              </Link>
            ),
          )}
        </div>
      </section>
      </div>
    </div>
  )
}
