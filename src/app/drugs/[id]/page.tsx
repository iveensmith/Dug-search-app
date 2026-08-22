'use client'

import { use, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import PageHeader from '@/components/ui/PageHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import StockPulse from '@/components/StockPulse'
import RatingStars from '@/components/RatingStars'
import { type DrugSuggestion, type PharmacyResult } from '@/lib/types'
import DispensingBadge from '@/components/DispensingBadge'
import { dispensingClass } from '@/lib/dispensing'
import { isValidState, stateLabel } from '@/lib/states'
import { IconAlertCircle, IconStore } from '@/components/ui/icons'

type Payload = { drug: DrugSuggestion; stockedBy: PharmacyResult[]; siblings: DrugSuggestion[] }

const STATE_STORAGE_KEY = 'mediquest_state'

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3.5 dark:border-gray-800">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <strong className="mt-1 block text-sm text-gray-900 dark:text-gray-100">{value}</strong>
    </div>
  )
}

/**
 * The one sentence about handing the medicine over, in the place the
 * patient is about to choose a pharmacy from.
 *
 * Prescription-only gets a bordered note and a way to reach a pharmacist,
 * because it is the case where the app's answer is otherwise incomplete —
 * "six pharmacies have it" is true and still not enough. The other two
 * classes are reassurance, so they read as a plain line and nothing more.
 * An unclassified drug renders nothing at all.
 */
function DispensingNote({ value }: { value: string | null | undefined }) {
  const c = dispensingClass(value)
  if (!c) return null

  if (c.key !== 'POM') {
    return (
      <p className="mt-4 flex items-start gap-2 px-1 text-sm text-gray-500 dark:text-gray-400">
        <IconAlertCircle width={14} height={14} className="mt-0.5 shrink-0" />
        {c.note}
      </p>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
        <IconAlertCircle width={16} height={16} className="shrink-0" />
        {c.label}
      </p>
      <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-200/90">{c.note}</p>
      <Link
        href="/prescriptions"
        className="mt-2.5 inline-block text-sm font-bold text-amber-900 underline underline-offset-2 dark:text-amber-300"
      >
        Don&apos;t have one? Ask a pharmacist →
      </Link>
    </div>
  )
}

function DrugBody({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const [data, setData] = useState<Payload | null>(null)
  const [missing, setMissing] = useState(false)

  // Reuse whatever area the patient already picked on the search page so
  // "where to get it" is local rather than nationwide. Derived, not stored:
  // it's a pure function of the URL plus a remembered preference.
  const scope = useMemo(() => {
    const stored = typeof window === 'undefined' ? null : localStorage.getItem(STATE_STORAGE_KEY)
    const state = searchParams.get('state') ?? (stored && isValidState(stored) ? stored : null)
    return state ? { state, lga: searchParams.get('lga') } : null
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (scope?.state) params.set('state', scope.state)
    if (scope?.lga) params.set('lga', scope.lga)

    fetch(`/api/drugs/${id}?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [id, scope])

  if (missing) {
    return (
      <>
        <PageHeader title="Medicine Not Found" />
        <div className="mx-auto w-full max-w-2xl px-4 pt-8">
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
          >
            Back to search
          </Link>
        </div>
      </>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">
        <div className="h-56 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-40 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
      </div>
    )
  }

  const { drug, stockedBy, siblings } = data
  const areaLabel = scope
    ? scope.lga
      ? `${scope.lga}, ${stateLabel(scope.state)}`
      : stateLabel(scope.state)
    : null

  return (
    <div className="animate-fade-up">
      {/* The medicine's name is the page, so it goes in the band rather
          than a third of the way down the first card — and the badges go
          with it, because "prescription only" is the thing that decides
          whether the rest of the page is any use. */}
      <PageHeader
        title={drug.genericName}
        lede={drug.brandNames.length > 0 ? `Also sold as ${drug.brandNames.join(' · ')}` : undefined}
      >
        {(drug.category || drug.dispensing) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {drug.category && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                {drug.category}
              </span>
            )}
            <DispensingBadge value={drug.dispensing} className="px-3 py-1 font-bold" />
          </div>
        )}
      </PageHeader>

      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
      {/* The pill graphic that used to head this card is gone. It was
          standing in for a page title, and the title is in the band now —
          left where it was it is a 128px empty rectangle above the only
          facts on the page. */}
      <Card radius="lg">
        <div className="grid grid-cols-2 gap-3">
          <Spec label="Strength" value={drug.strength} />
          <Spec label="Form" value={drug.form.charAt(0) + drug.form.slice(1).toLowerCase()} />
          {drug.packSize && <Spec label="Pack size" value={drug.packSize} />}
          <Spec
            label="Stocked by"
            value={
              areaLabel
                ? `${stockedBy.length} in ${scope!.lga ?? stateLabel(scope!.state)}`
                : 'Pick an area'
            }
          />
        </div>
      </Card>

      {/* Said before the pharmacy list, not after it: this is the thing
          that decides whether the journey is worth making at all. */}
      <DispensingNote value={drug.dispensing} />

      <Card radius="lg" className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {areaLabel ? `Where to get it in ${areaLabel}` : 'Where to get it'}
        </p>

        {!areaLabel ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
              Choose your state and LGA
            </Link>{' '}
            to see which nearby pharmacies have this in stock.
          </p>
        ) : stockedBy.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            No pharmacy in {areaLabel} has this listed right now.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
            {stockedBy.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/pharmacies/${r.id}`}
                  className="flex items-center gap-3 py-3.5 transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {r.name}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StockPulse stockUpdatedAt={r.stockUpdatedAt} />
                      <RatingStars value={r.ratingAvg} count={r.ratingCount} />
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-500 dark:text-gray-400">
                    {r.distanceKm.toFixed(1)} km
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {siblings.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Other strengths and forms
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/drugs/${s.id}`}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
              >
                {s.strength} · {s.form.toLowerCase()}
              </Link>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <IconAlertCircle width={14} height={14} className="mt-0.5 shrink-0" />
            A different strength or form is not automatically a substitute — confirm with your
            prescriber or a pharmacist before switching.
          </p>
        </div>
      )}

      <Link
        href="/"
        className="mt-6 flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
      >
        <IconStore width={16} height={16} />
        Search another medicine
      </Link>
      </div>
    </div>
  )
}

export default function DrugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      {/* Full width so the title band can run edge to edge, the way the
          home page's bands do. DrugBody puts the reading measure back on
          everything underneath. */}
      <main className="w-full flex-1 pb-16">
        <Suspense>
          <DrugBody id={id} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
