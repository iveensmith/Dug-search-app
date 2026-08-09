'use client'

import { useCallback, useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { IconPhone, IconTrash } from '@/components/ui/icons'

type Staff = {
  id: string
  phone: string
  displayName: string | null
  createdAt: string
}

/**
 * The phone numbers allowed to update this shop's stock over WhatsApp.
 *
 * The card leads with what adding a number actually grants, because the
 * number is the whole credential — there is no password behind it and no
 * sign-in to fail. Anyone holding that handset can mark medicines in or
 * out for this pharmacy, and an owner should be told that before they
 * type, not after.
 */
export default function StaffNumbersCard() {
  const [staff, setStaff] = useState<Staff[] | null>(null)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pharmacy/staff')
      if (!res.ok) {
        setStaff([])
        return
      }
      const data = await res.json()
      setStaff(data.staff ?? [])
    } catch {
      setStaff([])
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function add() {
    setError('')
    if (!phone.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/pharmacy/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, displayName: name || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not add that number')
        return
      }
      setPhone('')
      setName('')
      await load()
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(s: Staff) {
    const who = s.displayName ? `${s.displayName} (${s.phone})` : s.phone
    if (!confirm(`Stop ${who} from updating your stock over WhatsApp?`)) return
    setBusy(true)
    try {
      await fetch(`/api/pharmacy/staff/${s.id}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-6">
      <p className="font-semibold text-gray-900 dark:text-gray-100">WhatsApp stock updates</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Staff on these numbers can mark your medicines in or out of stock by messaging MediQuest on
        WhatsApp — no login needed. The number is all that identifies them, so only add handsets you
        trust, and remove one the moment somebody leaves.
      </p>

      {staff === null ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No numbers yet. Stock can only be changed from this dashboard.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  <IconPhone width={14} height={14} className="shrink-0 text-gray-400" />
                  {s.phone}
                </p>
                {s.displayName && (
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {s.displayName}
                  </p>
                )}
              </div>
              <button
                onClick={() => revoke(s)}
                disabled={busy}
                aria-label={`Remove ${s.phone}`}
                className="shrink-0 cursor-pointer rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <IconTrash width={15} height={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Phone number" htmlFor="staff-phone">
          <Input
            id="staff-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="e.g. 0803 123 4567"
          />
        </Field>
        <Field label="Whose phone?" hint="(optional)" htmlFor="staff-name">
          <Input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Blessing at the counter"
          />
        </Field>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <Button onClick={add} loading={busy} className="mt-3" size="sm">
        Add number
      </Button>
    </Card>
  )
}
