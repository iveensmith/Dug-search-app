'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { IconX } from '@/components/ui/icons'
import { HOLD_HOURS } from '@/lib/reservations'

export type ReservationResult = {
  id: string
  status: string
  /** When the pack was set aside — the two-hour hold counts from here. */
  readyAt: string | null
  pharmacy: { id: string; name: string }
  drug: { id: string }
}

/**
 * Asks a pharmacy to hold a drug. Everything except the pharmacy and the
 * drug is optional — a reservation with no quantity and no note is still a
 * useful "someone is coming for this".
 *
 * The copy avoids promising anything on the pharmacy's behalf: MediQuest
 * takes no payment and can't make a counter honour a request, so the
 * dialog says what it actually is — a message to the shop.
 */
export default function ReserveDialog({
  pharmacyId,
  pharmacyName,
  drugId,
  drugLabel,
  onClose,
  onReserved,
}: {
  pharmacyId: string
  pharmacyName: string
  drugId: string
  drugLabel: string
  onClose: () => void
  onReserved: (r: ReservationResult, alreadyOpen: boolean) => void
}) {
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Pre-fill the callback number from the account, but leave it editable —
  // the phone someone is reachable on today isn't always the one on file.
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.user?.phone) setPhone(data.user.phone)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyId,
          drugId,
          quantity: quantity ? Number(quantity) : undefined,
          note,
          contactPhone: phone,
        }),
      })
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent('/')}`
        return
      }
      const data = await res.json()
      if (res.status === 403) {
        // A pharmacy-owner or staff account hit Reserve — the API only
        // accepts patients, so say why rather than showing "Not allowed".
        setError('Reservations are for patient accounts. Log in as a patient to reserve.')
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not send your reservation')
        return
      }
      onReserved(data.reservation, Boolean(data.alreadyOpen))
      onClose()
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Reserve ${drugLabel} at ${pharmacyName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="animate-fade-up max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-50">Ask them to hold it</p>
            <p className="truncate text-sm text-gray-600 dark:text-gray-400">
              {drugLabel} · {pharmacyName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="How many?" hint="(optional)" htmlFor="reserve-qty">
            <Input
              id="reserve-qty"
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2"
            />
          </Field>

          <Field label="Phone they can call you on" hint="(optional)" htmlFor="reserve-phone">
            <Input
              id="reserve-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="e.g. 0803 123 4567"
            />
          </Field>

          <div>
            <label
              htmlFor="reserve-note"
              className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              Anything they should know? <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <Textarea
              id="reserve-note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Coming after 5pm"
              className="text-sm"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

        <Button onClick={submit} loading={busy} className="mt-5 w-full" size="lg">
          {busy ? 'Sending…' : 'Send reservation'}
        </Button>
        {/* The hold window is said here, before anyone commits, and counted
            down on the reservation afterwards. An expiry a patient only
            finds out about when it has already happened is worse than no
            expiry at all. */}
        <p className="mt-2.5 text-center text-xs text-gray-500 dark:text-gray-400">
          This sends a request to the pharmacy — nothing is paid and they may not be able to hold
          it. If they do set it aside, they&apos;ll keep it for {HOLD_HOURS} hours. Check your
          reservations to see their answer.
        </p>
      </div>
    </div>
  )
}
