'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { drugLabel, type DrugSuggestion } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import {
  IconAlertCircle,
  IconClipboardList,
  IconDownload,
  IconPlus,
  IconSearch,
  IconStore,
} from '@/components/ui/icons'

type Pharmacy = {
  name: string
  address: string
  state: string
  lga: string | null
  verificationStatus: string
}

type Item = { id: string; inStock: boolean; drug: DrugSuggestion }

type RecentSearch = { id: string; drug: DrugSuggestion | null; youStock: boolean }

type Scope = { kind: 'lga' | 'state'; label: string }

type Gap = { drug: DrugSuggestion; count: number }

/**
 * The home page for a signed-in pharmacy owner. Patients get the search
 * hero; owners get their own shop at a glance — stock counts, verification
 * state, and the drugs patients in their own LGA searched for that they
 * don't stock. Built entirely from the existing dashboard endpoints.
 */
export default function OwnerHome({ displayName }: { displayName: string | null }) {
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null)
  const [items, setItems] = useState<Item[] | null>(null)
  const [searches, setSearches] = useState<RecentSearch[] | null>(null)
  const [scope, setScope] = useState<Scope | null>(null)
  const [noPharmacy, setNoPharmacy] = useState(false)

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
        setItems(data.items)
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
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <IconStore width={22} height={22} />
          </span>
          <p className="mt-3 font-semibold text-gray-900 dark:text-gray-100">
            Let&apos;s add your pharmacy
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Register your outlet so patients searching nearby can see what you have in stock.
          </p>
          <Link
            href="/pharmacy/register"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950"
          >
            Add your outlet
          </Link>
        </Card>
      </div>
    )
  }

  const inStock = items?.filter((i) => i.inStock).length ?? 0
  const outOfStock = (items?.length ?? 0) - inStock
  const approved = pharmacy?.verificationStatus === 'APPROVED'

  return (
    <div className="animate-fade-up py-10 md:py-14">
      <header>
        <p className="text-sm font-semibold italic text-emerald-700 dark:text-emerald-400">
          Pharmacy dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-50">
          {displayName ? `Welcome back, ${displayName.split(' ')[0]}` : 'Welcome back'}
        </h1>
        {pharmacy && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-gray-100">{pharmacy.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              {pharmacy.lga ? `${pharmacy.lga}, ` : ''}
              {stateLabel(pharmacy.state)}
            </span>
            {approved && <VerifiedBadge />}
          </p>
        )}
      </header>

      {pharmacy && !approved && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
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

      <dl className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          ['Drugs listed', items?.length],
          ['In stock', inStock],
          ['Out of stock', outOfStock],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-2xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900 sm:p-5"
          >
            <dd className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-50">
              {items === null ? '—' : (value as number)}
            </dd>
            <dt className="mt-1 text-xs font-medium text-gray-500 sm:text-sm dark:text-gray-400">
              {label as string}
            </dt>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/pharmacy"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition-all hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-600/25 dark:bg-emerald-500 dark:text-emerald-950"
        >
          <IconClipboardList width={18} height={18} />
          Manage inventory
        </Link>
        <Link
          href="/pharmacy"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-600/60 px-5 py-3 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-400/50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
        >
          <IconPlus width={18} height={18} />
          Add a drug
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-50">
          <IconSearch width={18} height={18} className="text-emerald-600 dark:text-emerald-400" />
          Local demand you&apos;re missing
        </h2>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
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
                className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-gray-800" />
              </li>
            ))}
          </ul>
        ) : gaps.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nothing to act on — you stock everything patients searched for recently.
          </p>
        ) : (
          <ul className="stagger mt-4 space-y-2">
            {gaps.map(({ drug, count }) => (
              <li key={drug.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {drugLabel(drug)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {count} {count === 1 ? 'search' : 'searches'}{' '}
                      recently · you don&apos;t stock this
                    </p>
                  </div>
                  <Link href="/pharmacy" className="shrink-0">
                    <Button size="sm" variant="outline">
                      Add
                    </Button>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 border-t border-gray-200/80 pt-8 dark:border-gray-800/80">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Quick actions
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['Local searches', '/pharmacy'],
            ['Update opening hours', '/pharmacy'],
            ['Download stock CSV', '/pharmacy'],
            ['Account settings', '/account'],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
            >
              {label === 'Download stock CSV' && <IconDownload width={13} height={13} />}
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
