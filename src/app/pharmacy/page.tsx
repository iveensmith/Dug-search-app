'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type DrugSuggestion, drugLabel } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import AppHeader from '@/components/ui/AppHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Field, Input } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { IconAlertCircle, IconPlus, IconTrash, IconX } from '@/components/ui/icons'

type InventoryItem = {
  id: string
  inStock: boolean
  brand: string | null
  expiryDate: string | null
  updatedAt: string
  drug: DrugSuggestion
}

type Dashboard = {
  pharmacy: { id: string; name: string; address: string; state: string; verificationStatus: string }
  items: InventoryItem[]
}

type RecentSearch = {
  id: string
  queryText: string
  hadResults: boolean
  createdAt: string
  drug: DrugSuggestion | null
  youStock: boolean
}

function isExpired(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date()
}

export default function PharmacyDashboard() {
  const router = useRouter()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<'inventory' | 'searches'>('inventory')

  // add-drug panel
  const [formOpen, setFormOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([])
  const [selectedDrug, setSelectedDrug] = useState<DrugSuggestion | null>(null)
  const [brand, setBrand] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [adding, setAdding] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // recent searches tab
  const [searches, setSearches] = useState<RecentSearch[] | null>(null)

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

  useEffect(() => {
    if (tab !== 'searches' || searches !== null) return
    fetch('/api/pharmacy/recent-searches')
      .then((res) => res.json())
      .then((json) => setSearches(json.searches ?? []))
      .catch(() => setSearches([]))
  }, [tab, searches])

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

  function pickDrug(drug: DrugSuggestion) {
    setSelectedDrug(drug)
    setQuery('')
    setSuggestions([])
    const existing = data?.items.find((i) => i.drug.id === drug.id)
    setBrand(existing?.brand ?? '')
    setExpiryDate(existing?.expiryDate ? existing.expiryDate.slice(0, 10) : '')
  }

  function resetForm() {
    setFormOpen(false)
    setSelectedDrug(null)
    setQuery('')
    setSuggestions([])
    setBrand('')
    setExpiryDate('')
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDrug) return
    setAdding(true)
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugId: selectedDrug.id, brand, expiryDate }),
      })
      resetForm()
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
        <p className="text-gray-700 dark:text-gray-300">{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
          Back to search
        </Link>
      </div>
    )
  }

  if (!data) {
    return <p className="py-16 text-center text-gray-500 dark:text-gray-400">Loading dashboard…</p>
  }

  const { pharmacy, items } = data
  const inStockCount = items.filter((i) => i.inStock).length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <AppHeader title={pharmacy.name} subtitle={pharmacy.address} onLogout={logout} />

      {pharmacy.verificationStatus === 'PENDING' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <IconAlertCircle width={18} height={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Awaiting approval</p>
            <p className="mt-1">
              We&apos;re verifying your PCN license. Your pharmacy will appear in patient searches once
              approved — check back soon.
            </p>
          </div>
        </div>
      )}

      {pharmacy.verificationStatus === 'REJECTED' && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          <IconAlertCircle width={18} height={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Registration rejected</p>
            <p className="mt-1">
              Your registration could not be verified. Contact us if you believe this is a mistake.
            </p>
          </div>
        </div>
      )}

      {pharmacy.verificationStatus === 'APPROVED' && (
        <>
          <nav className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5">
            {(
              [
                ['inventory', `Inventory (${items.length})`],
                ['searches', 'Local searches'],
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

          {tab === 'inventory' && (
            <>
              {!formOpen ? (
                <Button onClick={() => setFormOpen(true)} className="w-full">
                  <IconPlus width={16} height={16} />
                  Add drug
                </Button>
              ) : (
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Add a drug</p>
                    <button
                      onClick={resetForm}
                      aria-label="Cancel"
                      className="cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
                    >
                      <IconX width={16} height={16} />
                    </button>
                  </div>

                  {!selectedDrug ? (
                    <div className="relative">
                      <Field label="Search the drug list" htmlFor="drug-query">
                        <Input
                          id="drug-query"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="e.g. Amoxicillin"
                          autoComplete="off"
                        />
                      </Field>
                      {suggestions.length > 0 && (
                        <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                          {suggestions.map((d) => {
                            const already = items.some((i) => i.drug.id === d.id)
                            return (
                              <li key={d.id}>
                                <button
                                  type="button"
                                  onClick={() => pickDrug(d)}
                                  className="flex w-full cursor-pointer items-center justify-between gap-2 bg-white px-4 py-2.5 text-left hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-white/5"
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{drugLabel(d)}</p>
                                    {d.brandNames.length > 0 && (
                                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">Brands: {d.brandNames.join(', ')}</p>
                                    )}
                                  </div>
                                  {already && (
                                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">Already listed</span>
                                  )}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Missing a drug? Only drugs on the master list can be added — contact us to
                        request an addition.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={submitAdd} className="space-y-4">
                      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                          {drugLabel(selectedDrug)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedDrug(null)}
                          className="cursor-pointer text-xs font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                        >
                          Change
                        </button>
                      </div>

                      <Field label="Brand" hint="(optional)" htmlFor="brand">
                        <Input
                          id="brand"
                          list="brand-suggestions"
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                          placeholder={selectedDrug.brandNames[0] ?? 'e.g. Panadol'}
                          autoComplete="off"
                        />
                        <datalist id="brand-suggestions">
                          {selectedDrug.brandNames.map((b) => (
                            <option key={b} value={b} />
                          ))}
                        </datalist>
                      </Field>

                      <Field label="Expiry date" hint="(optional)" htmlFor="expiryDate">
                        <Input
                          id="expiryDate"
                          type="date"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                        />
                      </Field>

                      <Button type="submit" loading={adding} className="w-full">
                        {adding ? 'Adding…' : 'Add to inventory'}
                      </Button>
                    </form>
                  )}
                </Card>
              )}

              <div className="mt-6">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your drugs ({items.length})</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{inStockCount} in stock</p>
                </div>

                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No drugs listed yet — tap &ldquo;Add drug&rdquo; above to add your first one.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.id}>
                        <Card padded={false} className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900 dark:text-gray-100">{drugLabel(item.drug)}</p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                              {item.brand ?? (item.drug.brandNames.length > 0 ? item.drug.brandNames.join(', ') : null) ?? 'No brand noted'}
                            </p>
                            {item.expiryDate && (
                              <p className={`text-xs ${isExpired(item.expiryDate) ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {isExpired(item.expiryDate) ? 'Expired ' : 'Expires '}
                                {new Date(item.expiryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => toggle(item)}
                              aria-pressed={item.inStock}
                              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                item.inStock
                                  ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
                                  : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {item.inStock ? 'In stock' : 'Out of stock'}
                            </button>
                            <button
                              onClick={() => remove(item)}
                              aria-label={`Remove ${drugLabel(item.drug)}`}
                              className="cursor-pointer rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            >
                              <IconTrash width={16} height={16} />
                            </button>
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {tab === 'searches' && (
            <div>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                Recent patient searches in {stateLabel(pharmacy.state)} — see what&apos;s in local demand.
              </p>
              {!searches ? (
                <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading…</p>
              ) : searches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  No searches logged in your state yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {searches.map((s) => (
                    <li key={s.id}>
                      <Card className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {s.drug ? drugLabel(s.drug) : `“${s.queryText}”`}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {new Date(s.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {s.drug && (
                          <Badge tone={s.youStock ? 'success' : 'warning'} className="shrink-0">
                            {s.youStock ? 'You stock this' : "You don't stock this"}
                          </Badge>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
