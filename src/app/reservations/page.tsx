'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Button from '@/components/ui/Button'
import { drugLabel, relativeTime, type DrugSuggestion } from '@/lib/types'
import {
  HOLD_HOURS,
  RESERVATION_STATUS_META,
  holdTimeLeft,
  isOpen,
  isStale,
  type ReservationStatusValue,
} from '@/lib/reservations'
import LoadMore from '@/components/ui/LoadMore'
import { IconBookmark, IconPhone, IconPill, IconX } from '@/components/ui/icons'

// Only appears once the patient says they've picked it up, so it need not
// arrive with the list.
const RatePharmacyDialog = dynamic(() => import('@/components/RatePharmacyDialog'), { ssr: false })

type Reservation = {
  id: string
  quantity: number | null
  note: string | null
  status: ReservationStatusValue
  readyAt: string | null
  collectedAt: string | null
  createdAt: string
  pharmacy: { id: string; name: string; address: string; phone: string; lga: string | null }
  drug: DrugSuggestion
}

export default function ReservationsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Reservation[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [ratingPrompt, setRatingPrompt] = useState<{ id: string; name: string } | null>(null)

  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(
    async (after: string | null = null) => {
      const res = await fetch(`/api/reservations${after ? `?cursor=${after}` : ''}`)
      if (res.status === 401 || res.status === 403) {
        router.push('/login?next=/reservations')
        return
      }
      const data = await res.json()
      setRows((prev) => (after && prev ? [...prev, ...data.reservations] : data.reservations))
      setCursor(data.nextCursor ?? null)
    },
    [router],
  )

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      await load(cursor)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function setStatus(
    id: string,
    status: 'COLLECTED' | 'CANCELLED',
    pharmacy?: { id: string; name: string },
  ) {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not update that reservation')
        return
      }
      await load()
      // Only after collecting — cancelling means they never went, so there
      // is nothing to rate. The dialog drops itself if they've rated this
      // pharmacy before.
      if (status === 'COLLECTED' && pharmacy) setRatingPrompt(pharmacy)
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusyId(null)
    }
  }

  const open = rows?.filter((r) => isOpen(r.status)) ?? []
  const past = rows?.filter((r) => !isOpen(r.status)) ?? []

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <header className="py-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">My reservations</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Medicines you&apos;ve asked a pharmacy to hold
          </p>
        </header>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        {!rows ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <IconBookmark className="text-gray-400 dark:text-gray-500" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Nothing reserved yet. Search for a medicine, then tap Reserve on a pharmacy to ask
              them to hold it.
            </p>
            <Link
              href="/"
              className="mt-3 text-sm font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
            >
              Find a medicine
            </Link>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <ul className="space-y-3">
                {open.map((r) => (
                  <ReservationCard
                    key={r.id}
                    r={r}
                    busy={busyId === r.id}
                    onCollected={() =>
                      setStatus(r.id, 'COLLECTED', { id: r.pharmacy.id, name: r.pharmacy.name })
                    }
                    onCancel={() => setStatus(r.id, 'CANCELLED')}
                  />
                ))}
              </ul>
            )}

            {past.length > 0 && (
              <>
                <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Past
                </h2>
                <ul className="space-y-3">
                  {past.map((r) => (
                    <ReservationCard key={r.id} r={r} busy={false} />
                  ))}
                </ul>
              </>
            )}

            <LoadMore
              shown={rows.length}
              hasMore={cursor !== null}
              loading={loadingMore}
              onLoadMore={loadMore}
              noun="reservations"
            />
          </>
        )}
      </main>

      {ratingPrompt && (
        <RatePharmacyDialog
          pharmacyId={ratingPrompt.id}
          pharmacyName={ratingPrompt.name}
          intro="You got your medicine — how was it?"
          skipIfRated
          onClose={() => setRatingPrompt(null)}
        />
      )}

      <SiteFooter />
    </div>
  )
}

function ReservationCard({
  r,
  busy,
  onCollected,
  onCancel,
}: {
  r: Reservation
  busy: boolean
  onCollected?: () => void
  onCancel?: () => void
}) {
  const meta = RESERVATION_STATUS_META[r.status]
  const live = isOpen(r.status)
  const timeLeft = holdTimeLeft(r.status, r.readyAt)

  return (
    <li
      className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${
        live ? '' : 'opacity-75'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-50">{drugLabel(r.drug)}</p>
          <Link
            href={`/pharmacies/${r.pharmacy.id}`}
            className="text-sm text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
          >
            {r.pharmacy.name}
          </Link>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {r.pharmacy.address}
            {r.pharmacy.lga ? ` · ${r.pharmacy.lga}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
          {meta.patient}
        </span>
      </div>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {r.quantity ? `${r.quantity} asked for · ` : ''}
        {r.status === 'COLLECTED' && r.collectedAt
          ? `Collected ${relativeTime(r.collectedAt)}`
          : `Reserved ${relativeTime(r.createdAt)}`}
      </p>
      {r.note && (
        <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">“{r.note}”</p>
      )}

      {isStale(r.status, r.createdAt) && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          No answer in over a day — worth calling the pharmacy to check.
        </p>
      )}

      {/* The deadline, while there is still one. Emerald rather than amber:
          a hold running is good news, and the countdown is there to help
          them set off, not to alarm them. */}
      {timeLeft && (
        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Held for you · {timeLeft}
        </p>
      )}

      {/* And afterwards, what it actually means. The hold lapsed; the
          medicine is almost certainly still on the shelf, and saying so is
          the difference between a dead end and a next step. */}
      {r.status === 'EXPIRED' && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          The {HOLD_HOURS}-hour hold ran out, so the pharmacy can sell it again. It may well still
          be in stock — search for it to check, or call them.
        </p>
      )}

      {live && onCollected && onCancel && (
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Not "✓ Medicine obtained". The card already carries a status
              chip; a tick and a past tense on the button beside it read as
              a second, contradicting status rather than the thing you tap
              once you are holding the medicine. */}
          <Button variant="primary" size="sm" loading={busy} onClick={onCollected}>
            <IconPill width={15} height={15} />
            I&apos;ve picked it up
          </Button>
          <a
            href={`tel:${r.pharmacy.phone.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
          >
            <IconPhone width={15} height={15} />
            Call
          </a>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            <IconX width={15} height={15} />
            Cancel
          </Button>
        </div>
      )}
    </li>
  )
}
