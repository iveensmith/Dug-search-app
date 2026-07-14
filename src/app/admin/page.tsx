'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type AdminPharmacy = {
  id: string
  name: string
  address: string
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

type Analytics = {
  totalSearches: number
  noResultSearches: number
  stockGaps: { drugId: string; genericName: string; strength: string; form: string; searches: number; lastSearched: string }[]
  unmatchedQueries: { queryText: string; searches: number; lastSearched: string }[]
}

const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM', 'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'SUPPOSITORY', 'OTHER']

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-700',
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'pharmacies' | 'drugs' | 'gaps'>('pharmacies')
  const [pharmacies, setPharmacies] = useState<AdminPharmacy[] | null>(null)
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
    const [drugsRes, analyticsRes] = await Promise.all([
      fetch('/api/admin/drugs'),
      fetch('/api/admin/analytics'),
    ])
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
        <p className="text-gray-700">This page is for administrators only.</p>
        <Link href="/" className="mt-4 inline-block text-emerald-700 underline">Back to search</Link>
      </div>
    )
  }

  if (!pharmacies) return <p className="py-16 text-center text-gray-500">Loading admin panel…</p>

  const pending = pharmacies.filter((p) => p.verificationStatus === 'PENDING')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16">
      <header className="flex items-center justify-between py-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin — DrugFinder Uyo</h1>
          <p className="text-sm text-gray-600">
            {pending.length} pending registration{pending.length === 1 ? '' : 's'}
          </p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 underline">Log out</button>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {(
          [
            ['pharmacies', `Pharmacies (${pharmacies.length})`],
            ['drugs', `Drugs (${drugs?.length ?? '…'})`],
            ['gaps', 'Search gaps'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'pharmacies' && (
        <PharmaciesTab pharmacies={pharmacies} onSetStatus={setStatus} />
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
        <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{p.name}</p>
              <p className="text-sm text-gray-600">{p.address}</p>
              <p className="mt-1 text-xs text-gray-500">
                PCN: {p.pcnLicenseNumber} · {p.phone} · owner: {p.ownerEmail ?? p.ownerPhone} ·{' '}
                {p.inventoryCount} drugs listed
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[p.verificationStatus]}`}>
              {p.verificationStatus}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {p.verificationStatus !== 'APPROVED' && (
              <button
                onClick={() => onSetStatus(p.id, 'APPROVED')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Approve
              </button>
            )}
            {p.verificationStatus !== 'REJECTED' && (
              <button
                onClick={() => onSetStatus(p.id, 'REJECTED')}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"
              >
                Reject
              </button>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.latitude ?? ''},${p.longitude ?? ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto self-center text-sm text-emerald-700 underline"
            >
              View pin
            </a>
          </div>
        </li>
      ))}
    </ul>
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

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500'

  return (
    <div>
      <form onSubmit={save} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold text-gray-900">
          {editingId ? 'Edit drug' : 'Add a drug to the master list'}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input placeholder="Generic name" value={form.genericName} onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))} required className={inputCls} />
          <input placeholder="Strength, e.g. 500 mg" value={form.strength} onChange={(e) => setForm((f) => ({ ...f, strength: e.target.value }))} required className={inputCls} />
          <input placeholder="Brand names (comma-separated)" value={form.brandNames} onChange={(e) => setForm((f) => ({ ...f, brandNames: e.target.value }))} className={inputCls} />
          <select value={form.form} onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))} className={inputCls}>
            {FORMS.map((f) => (
              <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {editingId ? 'Save changes' : 'Add drug'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm({ genericName: '', brandNames: '', strength: '', form: 'TABLET' }) }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
        {drugs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">
                {d.genericName} {d.strength}{' '}
                <span className="text-xs font-normal text-gray-500">{d.form.toLowerCase()}</span>
              </p>
              <p className="truncate text-xs text-gray-500">
                {d.brandNames.length > 0 ? d.brandNames.join(', ') : 'no brands listed'} · stocked by {d.stockedByCount}
              </p>
            </div>
            <button onClick={() => startEdit(d)} className="shrink-0 text-sm font-medium text-emerald-700 underline">
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GapsTab({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return <p className="py-8 text-center text-gray-500">Loading analytics…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{analytics.totalSearches}</p>
          <p className="text-sm text-gray-600">total searches</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl font-bold text-amber-600">{analytics.noResultSearches}</p>
          <p className="text-sm text-gray-600">found nothing</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-semibold text-gray-900">Drugs searched but out of stock everywhere</h2>
        <p className="mb-3 text-sm text-gray-600">
          These drugs are in the list, but no approved pharmacy had them — stock gaps worth chasing.
        </p>
        {analytics.stockGaps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {analytics.stockGaps.map((g) => (
              <li key={g.drugId} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-gray-900">
                  {g.genericName} {g.strength}{' '}
                  <span className="text-xs font-normal text-gray-500">{g.form.toLowerCase()}</span>
                </span>
                <span className="text-sm text-gray-600">{g.searches}×</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-gray-900">Searches that matched no drug</h2>
        <p className="mb-3 text-sm text-gray-600">
          What people typed that isn&apos;t in the master list — candidates to add.
        </p>
        {analytics.unmatchedQueries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {analytics.unmatchedQueries.map((q) => (
              <li key={q.queryText} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-gray-900">“{q.queryText}”</span>
                <span className="text-sm text-gray-600">{q.searches}×</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
