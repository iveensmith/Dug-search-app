'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppHeader from '@/components/ui/AppHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { logout } from '@/lib/logout'
import { IconAlertCircle, IconCheck, IconTrash, IconPlus } from '@/components/ui/icons'

type Key = {
  id: string
  label: string
  prefix: string
  lastUsedAt: string | null
  createdAt: string
}

/**
 * Where an owner gets a key for their own software.
 *
 * The screen is mostly one warning, delivered once and honestly: the key
 * is shown here and nowhere else, ever. That is a property of storing
 * only its hash, not a policy we could soften — so the page says it
 * before creating one, not after.
 */
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[] | null>(null)
  const [label, setLabel] = useState('')
  const [issued, setIssued] = useState<{ raw: string; label: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pharmacy/api-keys')
      if (!res.ok) return
      const data = await res.json()
      setKeys(data.keys ?? [])
    } catch {
      setKeys([])
    }
  }, [])

  // Deferred out of the effect body, same as the dashboard's own load:
  // setting state synchronously inside an effect is what the lint rule is
  // about, and a zero timeout puts the fetch after the first paint.
  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/pharmacy/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not create that key.')
        return
      }
      setIssued({ raw: data.key.raw, label: data.key.label })
      setLabel('')
      load()
    } catch {
      setError('Network problem — try again.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string, name: string) {
    if (!confirm(`Revoke "${name}"? Any software using it stops working immediately.`)) return
    await fetch(`/api/pharmacy/api-keys/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <AppHeader
        backHref="/pharmacy"
        title="Connect your own software"
        subtitle="Keys for your POS or inventory tool"
        onLogout={logout}
        width="max-w-2xl"
      />

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <Card className="mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            If your shop already tracks stock somewhere — a POS, a spreadsheet macro, something
            built for you — it can send that stock here instead of anyone retyping it. Create a key,
            give it to whoever maintains that software, and point them at{' '}
            <Link href="/docs/api" className="font-semibold text-emerald-700 underline dark:text-emerald-400">
              the instructions
            </Link>
            .
          </p>
        </Card>

        {issued && (
          <Card className="mt-4 border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300">
              <IconCheck width={16} height={16} />
              &ldquo;{issued.label}&rdquo; created
            </p>
            <p className="mt-1.5 text-sm text-emerald-900/90 dark:text-emerald-200/90">
              Copy it now. We only keep a scrambled copy, so this is the one and only time it can
              be shown — if it is lost, revoke it and make another.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-xs break-all dark:bg-gray-900">
                {issued.raw}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(issued.raw)
                  setCopied(true)
                }}
                className="shrink-0 cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => {
                setIssued(null)
                setCopied(false)
              }}
              className="mt-3 cursor-pointer text-sm font-semibold text-emerald-900 underline dark:text-emerald-300"
            >
              I have saved it
            </button>
          </Card>
        )}

        <Card className="mt-4">
          <form onSubmit={create}>
            <Field label="Name this key" htmlFor="label">
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Front counter POS"
                maxLength={60}
              />
            </Field>
            <Button type="submit" disabled={busy || !label.trim()} className="mt-3">
              <IconPlus width={16} height={16} />
              {busy ? 'Creating…' : 'Create a key'}
            </Button>
          </form>
          {error && (
            <p className="mt-2 flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
              <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </Card>

        <div className="mt-5">
          <h2 className="px-1 text-sm font-bold text-gray-900 dark:text-gray-100">Your keys</h2>
          {keys === null ? (
            <p className="mt-2 px-1 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No keys yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{k.label}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {k.prefix}…
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {k.lastUsedAt
                        ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                        : 'Never used'}
                    </p>
                  </div>
                  <button
                    onClick={() => revoke(k.id, k.label)}
                    aria-label={`Revoke ${k.label}`}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
