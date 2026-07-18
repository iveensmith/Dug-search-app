'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { stateLabel } from '@/lib/states'
import AppHeader from '@/components/ui/AppHeader'
import Card from '@/components/ui/Card'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'

type AdminPharmacy = {
  id: string
  name: string
  address: string
  state: string
  phone: string
  latitude: number
  longitude: number
  pcnLicenseNumber: string
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  ownerEmail: string | null
  ownerPhone: string | null
  inventoryCount: number
  createdAt: string
}

type AdminDrug = {
  id: string
  genericName: string
  brandNames: string[]
  strength: string
  form: string
  stockedByCount: number
}

type AdminPharmacist = {
  id: string
  email: string | null
  phone: string | null
  displayName: string | null
  claimedCount: number
  createdAt: string
}

type Analytics = {
  totalSearches: number
  noResultSearches: number
  stockGaps: { drugId: string; genericName: string; strength: string; form: string; searches: number; lastSearched: string }[]
  unmatchedQueries: { queryText: string; searches: number; lastSearched: string }[]
}

const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM', 'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'SUPPOSITORY', 'OTHER']

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'pharmacies' | 'pharmacists' | 'drugs' | 'gaps'>('pharmacies')
  const [pharmacies, setPharmacies] = useState<AdminPharmacy[] | null>(null)
  const [pharmacists, setPharmacists] = useState<AdminPharmacist[] | null>(null)
  const [drugs, setDrugs] = useState<AdminDrug[] | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/pharmacies')
    if (res.status === 401) {
      router.push('/login?next=/admin')
      return
    }
    if (res.status === 403) {
      setDenied(true)
      return
    }
    setPharmacies((await res.json()).pharmacies)
    const [pharmacistsRes, drugsRes, analyticsRes] = await Promise.all([
      fetch('/api/admin/pharmacists'),
      fetch('/api/admin/drugs'),
      fetch('/api/admin/analytics'),
    ])
    if (pharmacistsRes.ok) setPharmacists((await pharmacistsRes.json()).pharmacists)
    if (drugsRes.ok) setDrugs((await drugsRes.json()).drugs)
    if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function setStatus(id: string, verificationStatus: string) {
    await fetch(`/api/admin/pharmacies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationStatus }),
    })
    load()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-gray-700 dark:text-gray-300">This page is for administrators only.</p>
        <Link href="/" className="mt-4 inline-block text-emerald-700 underline underline-offset-2 dark:text-emerald-400">Back to search</Link>
      </div>
    )
  }

  if (!pharmacies) return <p className="py-16 text-center text-gray-500 dark:text-gray-400">Loading admin panel…</p>

  const pending = pharmacies.filter((p) => p.verificationStatus === 'PENDING')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16">
      <AppHeader
        title="Admin — PharmaFinder"
        subtitle={`${pending.length} pending registration${pending.length === 1 ? '' : 's'}`}
        onLogout={logout}
      />

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-white/5">
        {(
          [
            ['pharmacies', `Pharmacies (${pharmacies.length})`],
            ['pharmacists', `Pharmacists (${pharmacists?.length ?? '…'})`],
            ['drugs', `Drugs (${drugs?.length ?? '…'})`],
            ['gaps', 'Search gaps'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 cursor-pointer whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-50'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'pharmacies' && (
        <PharmaciesTab pharmacies={pharmacies} onSetStatus={setStatus} />
      )}
      {tab === 'pharmacists' && pharmacists && (
        <PharmacistsTab pharmacists={pharmacists} onChanged={load} />
      )}
      {tab === 'drugs' && drugs && <DrugsTab drugs={drugs} onChanged={load} />}
      {tab === 'gaps' && <GapsTab analytics={analytics} />}
    </div>
  )
}

function PharmaciesTab({
  pharmacies,
  onSetStatus,
}: {
  pharmacies: AdminPharmacy[]
  onSetStatus: (id: string, status: string) => void
}) {
  const ordered = [...pharmacies].sort((a, b) => {
    const rank = (s: string) => (s === 'PENDING' ? 0 : s === 'APPROVED' ? 1 : 2)
    return rank(a.verificationStatus) - rank(b.verificationStatus)
  })
  return (
    <ul className="space-y-3">
      {ordered.map((p) => (
        <li key={p.id}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{p.address}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  {stateLabel(p.state)} · PCN: {p.pcnLicenseNumber} · {p.phone} · owner:{' '}
                  {p.ownerEmail ?? p.ownerPhone} ·{' '}
                  {p.inventoryCount} drugs listed
                </p>
              </div>
              <Badge tone={STATUS_TONE[p.verificationStatus]}>{p.verificationStatus}</Badge>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {p.verificationStatus !== 'APPROVED' && (
                <Button size="sm" onClick={() => onSetStatus(p.id, 'APPROVED')}>
                  Approve
                </Button>
              )}
              {p.verificationStatus !== 'REJECTED' && (
                <Button size="sm" variant="destructive" onClick={() => onSetStatus(p.id, 'REJECTED')}>
                  Reject
                </Button>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${p.latitude ?? ''},${p.longitude ?? ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-sm text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                View pin
              </a>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function PharmacistsTab({
  pharmacists,
  onChanged,
}: {
  pharmacists: AdminPharmacist[]
  onChanged: () => void
}) {
  const [form, setForm] = useState({ displayName: '', email: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setCreated(null)
    try {
      const res = await fetch('/api/admin/pharmacists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not create account')
        return
      }
      setCreated({ email: data.pharmacist.email, tempPassword: data.temporaryPassword })
      setForm({ displayName: '', email: '' })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string, label: string) {
    if (!confirm(`Revoke access for ${label}? They won't be able to log in anymore.`)) return
    const res = await fetch(`/api/admin/pharmacists/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not revoke — they may have open conversations')
      return
    }
    onChanged()
  }

  return (
    <div>
      <Card>
        <form onSubmit={create}>
          <p className="mb-1 font-semibold text-gray-900 dark:text-gray-100">Create a pharmacist account</p>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Pharmacists are a vetted role — there is no public sign-up. Verify their license yourself,
            then create their login here.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name" htmlFor="pharmacist-name">
              <Input
                id="pharmacist-name"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                required
              />
            </Field>
            <Field label="Email" htmlFor="pharmacist-email">
              <Input
                id="pharmacist-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </Field>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          {created && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <p className="font-medium">
                Account created for {created.email}. Share this temporary password with them — it
                won&apos;t be shown again:
              </p>
              <p className="mt-1 font-mono text-base font-bold">{created.tempPassword}</p>
            </div>
          )}
          <Button type="submit" loading={busy} className="mt-3">
            {busy ? 'Creating…' : 'Create pharmacist account'}
          </Button>
        </form>
      </Card>

      <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        {pharmacists.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No pharmacist accounts yet.</li>
        )}
        {pharmacists.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-gray-100">{p.displayName ?? 'Unnamed'}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {p.email ?? p.phone} · claimed {p.claimedCount} conversation{p.claimedCount === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => revoke(p.id, p.displayName ?? p.email ?? 'this pharmacist')}
              className="shrink-0 cursor-pointer text-sm font-medium text-red-600 underline underline-offset-2 dark:text-red-400"
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DrugsTab({ drugs, onChanged }: { drugs: AdminDrug[]; onChanged: () => void }) {
  const [form, setForm] = useState({ genericName: '', brandNames: '', strength: '', form: 'TABLET' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function startEdit(d: AdminDrug) {
    setEditingId(d.id)
    setForm({
      genericName: d.genericName,
      brandNames: d.brandNames.join(', '),
      strength: d.strength,
      form: d.form,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const payload = {
      genericName: form.genericName.trim(),
      brandNames: form.brandNames.split(',').map((b) => b.trim()).filter(Boolean),
      strength: form.strength.trim(),
      form: form.form,
    }
    try {
      const res = await fetch(editingId ? `/api/admin/drugs/${editingId}` : '/api/admin/drugs', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      setForm({ genericName: '', brandNames: '', strength: '', form: 'TABLET' })
      setEditingId(null)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Card>
        <form onSubmit={save}>
          <p className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
            {editingId ? 'Edit drug' : 'Add a drug to the master list'}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Generic name" htmlFor="drug-generic">
              <Input id="drug-generic" value={form.genericName} onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))} required />
            </Field>
            <Field label="Strength" htmlFor="drug-strength">
              <Input id="drug-strength" placeholder="e.g. 500 mg" value={form.strength} onChange={(e) => setForm((f) => ({ ...f, strength: e.target.value }))} required />
            </Field>
            <Field label="Brand names" hint="(comma-separated)" htmlFor="drug-brands">
              <Input id="drug-brands" value={form.brandNames} onChange={(e) => setForm((f) => ({ ...f, brandNames: e.target.value }))} />
            </Field>
            <Field label="Form" htmlFor="drug-form">
              <Select id="drug-form" value={form.form} onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))}>
                {FORMS.map((f) => (
                  <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>
                ))}
              </Select>
            </Field>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button type="submit" loading={busy}>
              {editingId ? 'Save changes' : 'Add drug'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setEditingId(null); setForm({ genericName: '', brandNames: '', strength: '', form: 'TABLET' }) }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        {drugs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                {d.genericName} {d.strength}{' '}
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{d.form.toLowerCase()}</span>
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {d.brandNames.length > 0 ? d.brandNames.join(', ') : 'no brands listed'} · stocked by {d.stockedByCount}
              </p>
            </div>
            <button onClick={() => startEdit(d)} className="shrink-0 cursor-pointer text-sm font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GapsTab({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading analytics…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics.totalSearches}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">total searches</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{analytics.noResultSearches}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">found nothing</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Drugs searched but out of stock everywhere</h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          These drugs are in the list, but no approved pharmacy had them — stock gaps worth chasing.
        </p>
        {analytics.stockGaps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {analytics.stockGaps.map((g) => (
              <li key={g.drugId} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {g.genericName} {g.strength}{' '}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{g.form.toLowerCase()}</span>
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{g.searches}×</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Searches that matched no drug</h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          What people typed that isn&apos;t in the master list — candidates to add.
        </p>
        {analytics.unmatchedQueries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {analytics.unmatchedQueries.map((q) => (
              <li key={q.queryText} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-gray-900 dark:text-gray-100">“{q.queryText}”</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{q.searches}×</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
