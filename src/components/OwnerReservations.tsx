'use client'

import { useState } from 'react'
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
import { IconBookmark, IconPhone, IconStore, IconX } from '@/components/ui/icons'

export type OwnerReservation = {
  id: string
  quantity: number | null
  note: string | null
  contactPhone: string | null
  status: ReservationStatusValue
  readyAt: string | null
  collectedAt: string | null
  createdAt: string
  patientName: string
  drug: DrugSuggestion
}

/**
 * The counter's queue. Deliberately blunt about what each action means:
 * "Set aside" says the pharmacy has physically put it away, and declining
 * is offered just as plainly, because a request nobody can honour is
 * better closed than left hanging.
 */
export default function OwnerReservations({
  reservations,
  onChanged,
}: {
  reservations: OwnerReservation[] | null
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function setStatus(id: string, status: 'READY' | 'COLLECTED' | 'DECLINED') {
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
      onChanged()
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusyId(null)
    }
  }

  if (reservations === null) {
    return <p className="py-8 text-center text-faint">Loading…</p>
  }

  const live = reservations.filter((r) => isOpen(r.status))
  const past = reservations.filter((r) => !isOpen(r.status))

  return (
    <div>
      <div className="mb-4 flex items-start gap-3 rounded-control bg-info-soft p-3.5 text-sm text-blue-800 dark:text-blue-300">
        <IconBookmark width={18} height={18} className="mt-0.5 shrink-0" />
        <p>
          Patients can ask you to hold a drug they found in your stock list. Nothing is paid and
          you&apos;re not committed — set it aside if you can, or decline so they can try elsewhere.
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}

      {reservations.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong p-8 text-center">
          <p className="text-sm text-faint">
            No reservations yet. They appear here as soon as a patient asks you to hold something.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {live.map((r) => (
              <li
                key={r.id}
                className="rounded-card border border-line bg-surface p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {drugLabel(r.drug)}
                    </p>
                    <p className="text-sm text-muted">
                      {r.patientName}
                      {r.quantity ? ` · ${r.quantity} asked for` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${RESERVATION_STATUS_META[r.status].tone}`}
                  >
                    {RESERVATION_STATUS_META[r.status].pharmacy}
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-faint">
                  Asked {relativeTime(r.createdAt)}
                </p>
                {r.note && (
                  <p className="mt-1 text-xs italic text-faint">
                    “{r.note}”
                  </p>
                )}
                {isStale(r.status, r.createdAt) && (
                  <p className="mt-1.5 text-xs text-warn-ink">
                    Waiting over a day for your answer.
                  </p>
                )}

                {/* How long this pack is spoken for. The counter's version
                    of the countdown answers a different question from the
                    patient's: not "can I still get there" but "when is
                    this mine to sell again". */}
                {holdTimeLeft(r.status, r.readyAt) && (
                  <p className="mt-1.5 text-xs font-semibold text-brand-ink">
                    Set aside · {holdTimeLeft(r.status, r.readyAt)}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === 'PENDING' && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={busyId === r.id}
                      onClick={() => setStatus(r.id, 'READY')}
                    >
                      <IconBookmark width={15} height={15} />
                      Set aside
                    </Button>
                  )}
                  {/* "Collected" was both the button and the status chip
                      this row turns into — the same word for the thing you
                      do and the thing that has happened. "Handed over" is
                      the counter action, and pairs with "Set aside". */}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, 'COLLECTED')}
                  >
                    <IconStore width={15} height={15} />
                    Handed over
                  </Button>
                  {r.contactPhone && (
                    <a
                      href={`tel:${r.contactPhone.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-2 rounded-control border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:border-line-brand hover:text-brand-ink"
                    >
                      <IconPhone width={15} height={15} />
                      {r.contactPhone}
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, 'DECLINED')}
                  >
                    <IconX width={15} height={15} />
                    Can&apos;t hold it
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {past.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-faint">
                Closed
              </h3>
              <ul className="space-y-2">
                {past.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-control border border-line px-3.5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-muted">
                        {drugLabel(r.drug)}
                      </p>
                      <p className="text-xs text-faint">
                        {r.patientName} ·{' '}
                        {r.collectedAt
                          ? `collected ${relativeTime(r.collectedAt)}`
                          : relativeTime(r.createdAt)}
                      </p>
                      {/* The one closed state with something still to do
                          about it: there is a real pack behind the counter
                          with this person's name on it, and nobody is
                          coming for it. */}
                      {r.status === 'EXPIRED' && (
                        <p className="mt-0.5 text-xs font-medium text-warn-ink">
                          Nobody came within {HOLD_HOURS} hours — put it back on the shelf.
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${RESERVATION_STATUS_META[r.status].tone}`}
                    >
                      {RESERVATION_STATUS_META[r.status].pharmacy}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
