'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type DrugSuggestion, drugLabel } from '@/lib/types'

type InventoryItem = {
  id: string
  inStock: boolean
  updatedAt: string
  drug: DrugSuggestion
}

type Dashboard = {
  pharmacy: { id: string; name: string; address: string; verificationStatus: string }
  items: InventoryItem[]
}

export default function PharmacyDashboard() {
  const router = useRouter()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([])
  const [adding, setAdding] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/inventory')
    if (res.status === 401) {
      router.push('/login?next=/pharmacy')
      return
    }
    if (res.status === 403) {
      setLoadError('This account is not a pharmacy owner account.')
      return
    }
    if (!res.ok) {
      setLoadError('Could not load your dashboard — try refreshing.')
      return
    }
    setData(await res.json())
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  // Drug autocomplete for search-and-add (master list only — no free text)
  useEffect(() => {
    const q = query.trim()
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setSuggestions([])
        return
      }
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        const json = await res.json()
        setSuggestions(json.drugs ?? [])
      } catch {
        /* aborted */
      }
    }, q.length < 2 ? 0 : 250)
    return () => clearTimeout(timer)
  }, [query])

  async function addDrug(drug: DrugSuggestion) {
    setAdding(true)
    setQuery('')
    setSuggestions([])
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugId: drug.id }),
      })
      await load()
    } finally {
      setAdding(false)
    }
  }

  async function toggle(item: InventoryItem) {
    // optimistic flip
    setData((d) =>
      d
        ? { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, inStock: !i.inStock } : i)) }
        : d,
    )
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inStock: !item.inStock }),
    })
    if (!res.ok) load() // revert on failure
  }

  async function remove(item: InventoryItem) {
    if (!confirm(`Remove ${drugLabel(item.drug)} from your inventory list?`)) return
    await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' })
    load()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-gray-700">{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-emerald-700 underline">
          Back to search
        </Link>
      </div>
    )
  }

  if (!data) {
    return <p className="py-16 text-center text-gray-500">Loading dashboard…</p>
  }

  const { pharmacy, items } = data
  const inStockCount = items.filter((i) => i.inStock).length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="flex items-start justify-between py-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{pharmacy.name}</h1>
          <p className="text-sm text-gray-600">{pharmacy.address}</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 underline">
          Log out
        </button>
      </header>

      {pharmacy.verificationStatus === 'PENDING' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Awaiting approval</p>
          <p className="mt-1">
            We&apos;re verifying your PCN license. Your pharmacy will appear in patient searches once
            approved — check back soon.
          </p>
        </div>
      )}

      {pharmacy.verificationStatus === 'REJECTED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Registration rejected</p>
          <p className="mt-1">
            Your registration could not be verified. Contact us if you believe this is a mistake.
          </p>
        </div>
      )}

      {pharmacy.verificationStatus === 'APPROVED' && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Add a drug to your inventory
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the drug list, e.g. Amoxicillin"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              disabled={adding}
            />
            {suggestions.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                {suggestions.map((d) => {
                  const already = items.some((i) => i.drug.id === d.id)
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-2 bg-white px-4 py-2.5">
                      <div>
                        <p className="font-medium text-gray-900">{drugLabel(d)}</p>
                        {d.brandNames.length > 0 && (
                          <p className="text-xs text-gray-500">Brands: {d.brandNames.join(', ')}</p>
                        )}
                      </div>
                      {already ? (
                        <span className="text-xs text-gray-400">Already listed</span>
                      ) : (
                        <button
                          onClick={() => addDrug(d)}
                          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          Add
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Missing a drug? Only drugs on the master list can be added — contact us to request an
              addition.
            </p>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold text-gray-900">Your drugs ({items.length})</h2>
              <p className="text-sm text-gray-500">{inStockCount} in stock</p>
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No drugs listed yet — search above to add your first one.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{drugLabel(item.drug)}</p>
                      {item.drug.brandNames.length > 0 && (
                        <p className="truncate text-xs text-gray-500">
                          {item.drug.brandNames.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => toggle(item)}
                        aria-pressed={item.inStock}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                          item.inStock
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {item.inStock ? 'In stock' : 'Out of stock'}
                      </button>
                      <button
                        onClick={() => remove(item)}
                        aria-label={`Remove ${drugLabel(item.drug)}`}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 3l10 10M13 3L3 13" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
