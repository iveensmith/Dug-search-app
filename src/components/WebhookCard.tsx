'use client'

import { useCallback, useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { IconAlertCircle, IconCheck, IconSend, IconTrash } from '@/components/ui/icons'

type Delivery = {
  id: string
  event: string
  attempts: number
  deliveredAt: string | null
  failedAt: string | null
  lastStatus: number | null
  lastError: string | null
  createdAt: string
}

type Endpoint = {
  id: string
  url: string
  active: boolean
  lastOkAt: string | null
  deliveries: Delivery[]
} | null

/**
 * Where an owner points their events, and what happened to them.
 *
 * The delivery list is the whole point of the screen. A webhook that
 * quietly stopped working looks exactly like a webhook nothing has
 * happened on, and the difference matters — one means no patients
 * reserved anything today, the other means the counter has stopped being
 * told when they do.
 */
export default function WebhookCard() {
  const [endpoint, setEndpoint] = useState<Endpoint>(null)
  const [loaded, setLoaded] = useState(false)
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pharmacy/webhook')
      if (!res.ok) return
      const data = await res.json()
      setEndpoint(data.endpoint)
      setLoaded(true)
    } catch {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setTestResult('')
    try {
      const res = await fetch('/api/pharmacy/webhook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save that.')
        return
      }
      setSecret(data.secret)
      setUrl('')
      load()
    } catch {
      setError('Network problem — try again.')
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setTestResult('')
    try {
      const res = await fetch('/api/pharmacy/webhook', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setTestResult(
        data.ok
          ? 'Your server accepted it.'
          : `Not accepted — ${data.lastError ?? `HTTP ${data.lastStatus ?? '?'}`}. We will keep retrying.`,
      )
      load()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm('Stop sending events to this address?')) return
    await fetch('/api/pharmacy/webhook', { method: 'DELETE' })
    setSecret('')
    setTestResult('')
    load()
  }

  return (
    <Card className="mt-4">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100">Get told about reservations</h2>
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
        When a patient asks you to hold something, we can post it to your system straight away, so
        it lands on a screen at the counter instead of waiting for someone to check a dashboard.
      </p>

      {secret && (
        <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-300">
            <IconCheck width={15} height={15} />
            Saved. Here is your signing secret
          </p>
          <p className="mt-1 text-sm text-emerald-900/90 dark:text-emerald-200/90">
            Your server uses this to check that an event really came from us. Shown once.
          </p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-xs break-all dark:bg-gray-900">
            {secret}
          </code>
        </div>
      )}

      {endpoint ? (
        <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-gray-900 dark:text-gray-100">
                {endpoint.url}
              </p>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                {endpoint.lastOkAt
                  ? `Last accepted ${new Date(endpoint.lastOkAt).toLocaleString()}`
                  : 'Nothing delivered yet'}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={test}
                disabled={busy}
                className="cursor-pointer rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10"
                aria-label="Send a test event"
                title="Send a test event"
              >
                <IconSend width={16} height={16} />
              </button>
              <button
                onClick={remove}
                className="cursor-pointer rounded-lg p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40"
                aria-label="Stop sending events"
                title="Stop sending events"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
          </div>
          {testResult && (
            <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{testResult}</p>
          )}

          {endpoint.deliveries.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
              {endpoint.deliveries.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-gray-700 dark:text-gray-300">{d.event}</span>
                  <span
                    className={
                      d.deliveredAt
                        ? 'shrink-0 font-semibold text-emerald-700 dark:text-emerald-400'
                        : d.failedAt
                          ? 'shrink-0 font-semibold text-red-700 dark:text-red-400'
                          : 'shrink-0 font-semibold text-amber-700 dark:text-amber-400'
                    }
                  >
                    {d.deliveredAt
                      ? 'delivered'
                      : d.failedAt
                        ? `gave up after ${d.attempts}`
                        : `retrying (${d.attempts})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        loaded && (
          <form onSubmit={save} className="mt-3">
            <Field label="Where should we post them?" htmlFor="webhook-url">
              <Input
                id="webhook-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-system.example/mediquest"
                autoComplete="off"
              />
            </Field>
            <Button type="submit" disabled={busy || !url.trim()} className="mt-3">
              {busy ? 'Checking…' : 'Save'}
            </Button>
          </form>
        )
      )}

      {error && (
        <p className="mt-2 flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
          <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </Card>
  )
}
