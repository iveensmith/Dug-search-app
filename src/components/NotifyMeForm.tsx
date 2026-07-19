'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { IconCheck } from '@/components/ui/icons'
import type { NigerianStateValue } from '@/lib/states'

type Props = {
  drugId: string | null
  state: NigerianStateValue | null
}

/** Shown on a zero-result search — captures demand that would otherwise be
 *  lost. Emails the address once, when any pharmacy in that state marks the
 *  drug in stock (see the inStock-transition trigger in the inventory API). */
export default function NotifyMeForm({ drugId, state }: Props) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (!drugId || !state) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await fetch('/api/notify-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugId, state, email }),
      })
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      {sent ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <IconCheck width={16} height={16} />
          We&apos;ll email you when a pharmacy nearby has it in stock.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="notify-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notify me when it&apos;s in stock
            </label>
            <Input
              id="notify-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" loading={busy} className="shrink-0">
            {busy ? 'Saving…' : 'Notify me'}
          </Button>
        </form>
      )}
    </Card>
  )
}
