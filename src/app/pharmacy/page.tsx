'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { type DrugSuggestion, drugLabel } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import { useLgas } from '@/lib/useLgas'
import { DRUG_FORMS, formUsesPackSize, type DrugFormValue } from '@/lib/drugForms'
import { DRUG_CATEGORIES } from '@/lib/drugCategories'
import AppHeader from '@/components/ui/AppHeader'
import { logout } from '@/lib/logout'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import LoadMore from '@/components/ui/LoadMore'
import OwnerReservations, { type OwnerReservation } from '@/components/OwnerReservations'
import { isOpen } from '@/lib/reservations'
import { STOCK_LEVELS, type StockLevelKey } from '@/lib/stockLevels'
import DispensingBadge from '@/components/DispensingBadge'
import StaffNumbersCard from '@/components/StaffNumbersCard'
import { IconAlertCircle, IconCheck, IconDownload, IconPlus, IconTrash, IconUpload, IconX } from '@/components/ui/icons'

type InventoryItem = {
  id: string
  inStock: boolean
  brand: string | null
  expiryDate: string | null
  quantity: number | null
  stockLevel: string | null
  updatedAt: string
  drug: DrugSuggestion
}

type Dashboard = {
  pharmacy: {
    id: string
    name: string
    address: string
    state: string
    lga: string | null
    pcnLicenseNumber: string
    phone: string
    verificationStatus: string
    open24h: boolean
    opensAt: string | null
    closesAt: string | null
  }
  items: InventoryItem[]
  /** Whole-list counts from the server — `items` is one page of twenty. */
  inStockCount: number
  staleCount: number
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

// Shared brand/expiry/quantity/level fields for both the "pick existing
// drug" and "add a new drug" add-to-inventory forms.
function AddOnFields({
  brand,
  onBrandChange,
  brandSuggestions,
  expiryDate,
  onExpiryChange,
  quantity,
  onQuantityChange,
  level,
  onLevelChange,
}: {
  brand: string
  onBrandChange: (v: string) => void
  brandSuggestions?: string[]
  expiryDate: string
  onExpiryChange: (v: string) => void
  quantity: string
  onQuantityChange: (v: string) => void
  level: StockLevelKey | ''
  onLevelChange: (v: StockLevelKey | '') => void
}) {
  return (
    <>
      <Field label="Brand" hint="(optional)" htmlFor="brand">
        <Input
          id="brand"
          list={brandSuggestions ? 'brand-suggestions' : undefined}
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          placeholder={brandSuggestions?.[0] ?? 'e.g. Panadol'}
          autoComplete="off"
        />
        {brandSuggestions && (
          <datalist id="brand-suggestions">
            {brandSuggestions.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry date" hint="(optional)" htmlFor="expiryDate">
          <Input id="expiryDate" type="date" value={expiryDate} onChange={(e) => onExpiryChange(e.target.value)} />
        </Field>
        <Field label="Quantity" hint="(your own note)" htmlFor="quantity">
          <Input
            id="quantity"
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            placeholder="e.g. 50"
          />
        </Field>
      </div>

      {/* Chips rather than the quantity box, because that number has no
          unit beside it — 12 could be twelve boxes or twelve tablets — so
          it cannot be turned into something a patient can act on. Leaving
          it unset is a real answer and stays the default. */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          How much do you have?{' '}
          <span className="font-normal text-gray-500 dark:text-gray-400">
            (optional — patients see this)
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {STOCK_LEVELS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => onLevelChange(level === l.key ? '' : l.key)}
              aria-pressed={level === l.key}
              title={l.ownerHint}
              className={`min-h-10 cursor-pointer rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                level === l.key
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {l.ownerLabel}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {STOCK_LEVELS.find((l) => l.key === level)?.ownerHint ??
            'Leave blank and patients just see “In stock”.'}
        </p>
      </div>
    </>
  )
}

// Required — patient searches filter by LGA, so an outlet without one is
// invisible to LGA-scoped searches. Mainly here for outlets registered
// before the LGA field existed.
function LgaCard({
  pharmacy,
  onSaved,
}: {
  pharmacy: Dashboard['pharmacy']
  onSaved: (lga: string) => void
}) {
  const [lga, setLga] = useState(pharmacy.lga ?? '')
  const lgaOptions = useLgas(pharmacy.state)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!lga) {
      setError('Pick your LGA')
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/pharmacy/lga', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lga }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not save your LGA')
        return
      }
      onSaved(data.lga)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Network problem — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-gray-900 dark:text-gray-100">As registered</p>
      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
        What an admin checked against your PCN licence. Fixed once approved — correcting any of it
        means deleting this outlet and registering again.
      </p>

      <dl className="mt-3.5 space-y-2.5 text-sm">
        {(
          [
            ['Pharmacy name', pharmacy.name],
            ['Address', pharmacy.address],
            ['State', stateLabel(pharmacy.state)],
            ...(pharmacy.lga ? [['LGA', pharmacy.lga]] : []),
            ['PCN premises number', pharmacy.pcnLicenseNumber],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-gray-100 pb-2.5 last:border-0 last:pb-0 dark:border-gray-800"
          >
            <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="min-w-0 text-right font-medium text-gray-900 dark:text-gray-100">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* The only writable field here, and only while it is empty: outlets
          registered before LGAs existed have none, and searches filter by
          LGA — without this they would be invisible to patients for good. */}
      {!pharmacy.lga && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0" />
            <p>
              Required — patients search by LGA, so your pharmacy won&apos;t appear in their
              results until this is set. You can only set it once.
            </p>
          </div>
          <Field label={`Your LGA in ${stateLabel(pharmacy.state)}`} htmlFor="pharmacy-lga">
            <Select id="pharmacy-lga" value={lga} onChange={(e) => setLga(e.target.value)} required>
              <option value="" disabled>
                {lgaOptions.length === 0 ? 'Loading areas…' : 'Select your LGA'}
              </option>
              {lgaOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          <Button size="sm" className="mt-3" onClick={save} loading={saving}>
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save LGA'}
          </Button>
        </div>
      )}
    </Card>
  )
}

/**
 * The one registered detail that stays editable. It's what the Call button
 * on every search result dials, so a stale number quietly costs the shop
 * every patient who tries to ring ahead.
 */
function PhoneCard({
  pharmacy,
  onSaved,
}: {
  pharmacy: Dashboard['pharmacy']
  onSaved: (phone: string) => void
}) {
  const [phone, setPhone] = useState(pharmacy.phone)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/pharmacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save that number')
        return
      }
      setPhone(data.phone) // show it back normalised
      onSaved(data.phone)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Network problem — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-4">
      <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Phone</p>
      <Field label="Number patients call" htmlFor="pharmacy-phone">
        <Input
          id="pharmacy-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="e.g. 0803 123 4567"
        />
      </Field>
      {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <Button
        size="sm"
        className="mt-3"
        onClick={save}
        loading={saving}
        disabled={phone.trim() === pharmacy.phone}
      >
        {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save phone'}
      </Button>
    </Card>
  )
}

/**
 * The escape hatch for everything locked above. Deliberately unglamorous
 * and behind a typed confirmation — it destroys the shop's ratings and
 * history, and there is no undo.
 */
function DeleteOutletCard({ pharmacy }: { pharmacy: Dashboard['pharmacy'] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/pharmacy', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not delete this outlet')
        return
      }
      router.push('/pharmacy/register')
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-6 border-red-200 dark:border-red-900/60">
      <p className="font-semibold text-gray-900 dark:text-gray-100">Delete this outlet</p>
      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
        The way to correct anything registered above. Your login stays, so you can register the
        corrected outlet straight after — it goes back through approval as a new listing.
      </p>

      {!open ? (
        <Button variant="destructive" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          <IconTrash width={15} height={15} />
          Delete outlet
        </Button>
      ) : (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3.5 dark:border-red-900/60 dark:bg-red-950/30">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            This cannot be undone.
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            Your stock list, every patient rating and your reservation history are deleted with it.
            Ratings do not carry over to a new listing.
          </p>
          <div className="mt-3">
            <Field label={`Type "${pharmacy.name}" to confirm`} htmlFor="confirm-delete">
              <Input
                id="confirm-delete"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          {error && (
            <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              loading={busy}
              disabled={confirmName.trim().toLowerCase() !== pharmacy.name.toLowerCase()}
              onClick={remove}
            >
              <IconTrash width={15} height={15} />
              Permanently delete
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// Self-reported hours — no verification (see src/lib/hours.ts). Same every
// day, no per-day overrides.
function HoursCard({
  pharmacy,
  onSaved,
}: {
  pharmacy: Dashboard['pharmacy']
  onSaved: (hours: { open24h: boolean; opensAt: string | null; closesAt: string | null }) => void
}) {
  const [open24h, setOpen24h] = useState(pharmacy.open24h)
  const [opensAt, setOpensAt] = useState(pharmacy.opensAt ?? '08:00')
  const [closesAt, setClosesAt] = useState(pharmacy.closesAt ?? '21:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/pharmacy/hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open24h, opensAt: open24h ? null : opensAt, closesAt: open24h ? null : closesAt }),
      })
      if (res.ok) {
        onSaved(await res.json())
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="hours" className="mb-4 scroll-mt-24">
      <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Hours</p>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={open24h}
          onChange={(e) => setOpen24h(e.target.checked)}
          className="h-4 w-4 accent-emerald-600"
        />
        Open 24 hours
      </label>
      {!open24h && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Opens" htmlFor="opensAt">
            <Input id="opensAt" type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </Field>
          <Field label="Closes" htmlFor="closesAt">
            <Input id="closesAt" type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </Field>
        </div>
      )}
      <Button size="sm" className="mt-3" onClick={save} loading={saving}>
        {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save hours'}
      </Button>
    </Card>
  )
}

type BulkResult = { created: number; updated: number; errors: { row: number; message: string }[] }

// Columns match POST /api/inventory/bulk exactly — see that route for the
// per-column parsing rules (only genericName/strength/form required).
function BulkUploadPanel({ onImported, itemCount }: { onImported: () => void; itemCount: number }) {
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [result, setResult] = useState<BulkResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function downloadStock() {
    setExporting(true)
    setExportError('')
    try {
      const res = await fetch('/api/inventory/export')
      if (!res.ok) {
        setExportError('Could not export your stock — try again.')
        return
      }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `mediquest-stock-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Could not export your stock — try again.')
    } finally {
      setExporting(false)
    }
  }

  function downloadTemplate() {
    const csv =
      'genericName,strength,form,packSize,category,brand,quantity,expiryDate,inStock\n' +
      'Paracetamol,500 mg,TABLET,,Pain relief,Panadol,100,2027-06-30,true\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'mediquest-inventory-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setBusy(true)
    setResult(null)
    try {
      const csv = await file.text()
      const res = await fetch('/api/inventory/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      setResult(await res.json())
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="mb-4">
        <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Download your stock</p>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Export your current inventory ({itemCount} {itemCount === 1 ? 'drug' : 'drugs'}) as a CSV
          file — edit it offline and re-upload it below to update in bulk.
        </p>
        <Button variant="outline" size="sm" type="button" onClick={downloadStock} loading={exporting}>
          <IconDownload width={15} height={15} />
          {exporting ? 'Preparing…' : 'Download stock CSV'}
        </Button>
        {exportError && (
          <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{exportError}</p>
        )}
      </Card>

    <Card>
      <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Bulk upload from CSV</p>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Columns: genericName, strength, form, packSize, category, brand, quantity, expiryDate,
        inStock — only the first three are required.
      </p>
      <Button variant="outline" size="sm" type="button" onClick={downloadTemplate}>
        Download template CSV
      </Button>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
        <IconUpload width={18} height={18} className="shrink-0 text-gray-400 dark:text-gray-500" />
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:font-semibold file:text-white file:hover:bg-emerald-700 dark:text-gray-400 dark:file:bg-emerald-500 dark:file:text-emerald-950"
        />
      </div>
      <Button className="mt-3 w-full" loading={busy} onClick={upload}>
        {busy ? 'Uploading…' : 'Upload'}
      </Button>

      {result && (
        <div className="mt-4 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {result.created} added, {result.updated} updated
            {result.errors.length > 0 ? `, ${result.errors.length} skipped` : ''}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400">
              {result.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
    </>
  )
}

function PharmacyDashboard() {
  const router = useRouter()
  const [data, setData] = useState<Dashboard | null>(null)
  // The stock list arrives a page at a time now, so the counts on screen
  // come from the server rather than from items.length.
  const [inventoryTotal, setInventoryTotal] = useState(0)
  // In-stock rows past the 24-hour cliff, counted server-side across the
  // whole list rather than the page on screen.
  const [staleCount, setStaleCount] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmAsking, setConfirmAsking] = useState(false)
  const [inventoryPage, setInventoryPage] = useState(1)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [loadError, setLoadError] = useState('')
  // Opened straight from the overview's quick actions via "?tab=searches".
  // Read through useSearchParams, not window.location: on a client-side
  // navigation this component mounts before the browser URL is updated, so
  // location.search/hash is still the old page's at first render and the
  // tab would silently fall back to Inventory.
  const tabParam = useSearchParams().get('tab')
  const [tab, setTab] = useState<'inventory' | 'reservations' | 'searches' | 'bulk'>(
    tabParam === 'searches' || tabParam === 'reservations' || tabParam === 'bulk'
      ? tabParam
      : 'inventory',
  )

  // add-drug panel
  const [formOpen, setFormOpen] = useState(false)
  const [mode, setMode] = useState<'search' | 'new'>('search')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([])
  const [selectedDrug, setSelectedDrug] = useState<DrugSuggestion | null>(null)
  const [brand, setBrand] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [level, setLevel] = useState<StockLevelKey | ''>('')
  const [adding, setAdding] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // new-drug fields (mode === 'new')
  const [newGenericName, setNewGenericName] = useState('')
  const [newForm, setNewForm] = useState<DrugFormValue>('TABLET')
  const [newStrength, setNewStrength] = useState('')
  const [newPackSize, setNewPackSize] = useState('')
  const [newCategory, setNewCategory] = useState('')

  // recent searches tab
  const [searches, setSearches] = useState<RecentSearch[] | null>(null)
  const [searchScope, setSearchScope] = useState<string | null>(null)

  // Loaded with the dashboard rather than on tab open, so the tab itself
  // can show how many people are waiting on an answer.
  const [reservations, setReservations] = useState<OwnerReservation[] | null>(null)

  // "#hours" scrolls to the opening-hours card, which doesn't exist until
  // the dashboard data lands. Runs once — a later reload (after adding a
  // drug, say) shouldn't yank the page back up there.
  const scrolledToHours = useRef(false)

  const [reservationCursor, setReservationCursor] = useState<string | null>(null)
  const [loadingReservations, setLoadingReservations] = useState(false)

  const loadReservations = useCallback(async (after: string | null = null) => {
    try {
      const res = await fetch(`/api/pharmacy/reservations${after ? `?cursor=${after}` : ''}`)
      if (!res.ok) {
        if (!after) setReservations([])
        return
      }
      const json = await res.json()
      setReservations((prev) => (after && prev ? [...prev, ...json.reservations] : json.reservations))
      setReservationCursor(json.nextCursor ?? null)
    } catch {
      if (!after) setReservations([])
    }
  }, [])

  async function loadMoreReservations() {
    if (!reservationCursor) return
    setLoadingReservations(true)
    try {
      await loadReservations(reservationCursor)
    } finally {
      setLoadingReservations(false)
    }
  }

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
    const json = await res.json()
    setData(json)
    setInventoryTotal(json.total ?? 0)
    setStaleCount(json.staleCount ?? 0)
    setInventoryPage(1)
  }, [router])

  /**
   * Restamps every in-stock line as confirmed now.
   *
   * Deliberately behind a question rather than a single tap: the whole
   * point of the freshness stamp is that it means something, and a button
   * you can hit without reading is how it stops meaning anything.
   */
  async function confirmAllInStock() {
    setConfirming(true)
    setConfirmNote('')
    try {
      const res = await fetch('/api/inventory/confirm-all', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setConfirmNote(json.error ?? 'Could not confirm your list — try again.')
        return
      }
      setConfirmAsking(false)
      setConfirmNote(
        json.refreshed > 0
          ? `Confirmed ${json.confirmed} ${json.confirmed === 1 ? 'drug' : 'drugs'} — ${json.refreshed} of them were stale and are visible to patients again.`
          : `Confirmed ${json.confirmed} ${json.confirmed === 1 ? 'drug' : 'drugs'}. None had gone stale.`,
      )
      await load()
    } catch {
      setConfirmNote('Network problem — try again.')
    } finally {
      setConfirming(false)
    }
  }

  /** Next page of the stock list, appended. */
  async function loadMoreInventory() {
    setLoadingInventory(true)
    try {
      const next = inventoryPage + 1
      const res = await fetch(`/api/inventory?page=${next}`)
      if (!res.ok) return
      const json = await res.json()
      setData((d) => (d ? { ...d, items: [...d.items, ...json.items] } : d))
      setInventoryPage(next)
    } finally {
      setLoadingInventory(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const timer = setTimeout(() => loadReservations(), 0)
    return () => clearTimeout(timer)
  }, [loadReservations])

  useEffect(() => {
    if (!data || scrolledToHours.current || window.location.hash !== '#hours') return
    scrolledToHours.current = true
    // A frame's grace so the card is in the DOM before we scroll to it.
    const frame = requestAnimationFrame(() =>
      document.getElementById('hours')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [data])

  const openReservations = (reservations ?? []).filter((r) => isOpen(r.status)).length

  useEffect(() => {
    if (tab !== 'searches' || searches !== null) return
    fetch('/api/pharmacy/recent-searches')
      .then((res) => res.json())
      .then((json) => {
        setSearches(json.searches ?? [])
        setSearchScope(
          json.scope?.kind === 'lga' ? `${json.scope.label} LGA` : stateLabel(json.scope?.label ?? ''),
        )
      })
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
    setQuantity(existing?.quantity != null ? String(existing.quantity) : '')
    setLevel((existing?.stockLevel as StockLevelKey | null) ?? '')
  }

  function resetForm() {
    setFormOpen(false)
    setMode('search')
    setSelectedDrug(null)
    setQuery('')
    setSuggestions([])
    setBrand('')
    setExpiryDate('')
    setQuantity('')
    setLevel('')
    setNewGenericName('')
    setNewForm('TABLET')
    setNewStrength('')
    setNewPackSize('')
    setNewCategory('')
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'search' && !selectedDrug) return
    if (mode === 'new' && (!newGenericName.trim() || !newStrength.trim())) return
    setAdding(true)
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(mode === 'search'
            ? { drugId: selectedDrug!.id }
            : {
                newDrug: {
                  genericName: newGenericName,
                  strength: newStrength,
                  form: newForm,
                  packSize: newPackSize,
                  category: newCategory,
                  brand,
                },
              }),
          brand,
          expiryDate,
          quantity,
          stockLevel: level || null,
        }),
      })
      resetForm()
      await load()
    } finally {
      setAdding(false)
    }
  }

  async function updateQuantity(item: InventoryItem, raw: string) {
    const n = raw.trim() === '' ? null : Number(raw)
    if (n !== null && (!Number.isFinite(n) || n < 0)) return
    if (item.quantity === n) return
    setData((d) =>
      d ? { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, quantity: n } : i)) } : d,
    )
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: n }),
    })
    if (!res.ok) load()
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
  // From the server, not from items.filter(): the stock list arrives twenty
  // rows at a time, so counting what is loaded said "20 in stock" for a
  // shop with 282 — and the confirm-all dialog would have told the owner
  // they were vouching for twenty drugs while restamping all of them.
  const inStockCount = data?.inStockCount ?? 0

  return (
    <div className="flex min-h-dvh w-full flex-col">
    <AppHeader
      // Straight to the owner's own home rather than "/", which would only
      // bounce them here through the proxy redirect.
      backHref="/pharmacy/overview"
      title={
        pharmacy.verificationStatus === 'APPROVED' ? (
          <span className="flex items-center gap-2">
            {pharmacy.name}
            <VerifiedBadge />
          </span>
        ) : (
          pharmacy.name
        )
      }
      subtitle={pharmacy.address}
      onLogout={logout}
      width="max-w-2xl"
    />
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">

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
          <LgaCard
            pharmacy={pharmacy}
            onSaved={(lga) => setData((d) => (d ? { ...d, pharmacy: { ...d.pharmacy, lga } } : d))}
          />
          <PhoneCard
            pharmacy={pharmacy}
            onSaved={(phone) => setData((d) => (d ? { ...d, pharmacy: { ...d.pharmacy, phone } } : d))}
          />
          <HoursCard
            pharmacy={pharmacy}
            onSaved={(hours) => setData((d) => (d ? { ...d, pharmacy: { ...d.pharmacy, ...hours } } : d))}
          />

          <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-white/5">
            {(
              [
                ['inventory', `Inventory (${inventoryTotal})`],
                ['reservations', openReservations ? `Reservations (${openReservations})` : 'Reservations'],
                ['searches', 'Local searches'],
                ['bulk', 'CSV import/export'],
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
              {/* Sits above the add-drug button because refreshing what is
                  already listed is the daily job; adding is occasional. */}
              {inStockCount > 0 && (
                <Card className="mb-3">
                  {staleCount > 0 ? (
                    <div className="flex items-start gap-2.5">
                      <IconAlertCircle
                        width={16}
                        height={16}
                        className="mt-0.5 shrink-0 text-amber-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {staleCount} {staleCount === 1 ? 'drug has' : 'drugs have'} gone stale
                        </p>
                        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                          Listings older than 24 hours drop below fresher ones in patient searches.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your whole list was confirmed in the last 24 hours.
                    </p>
                  )}

                  {!confirmAsking ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setConfirmNote('')
                        setConfirmAsking(true)
                      }}
                    >
                      <IconCheck width={15} height={15} />
                      Confirm all still in stock
                    </Button>
                  ) : (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                      {/* Names what is being claimed, in the owner's own
                          terms. A patient may travel on the strength of it. */}
                      <p className="text-sm text-amber-900 dark:text-amber-200">
                        You&apos;re telling patients that all{' '}
                        <strong>{inStockCount}</strong> of your in-stock drugs are on your shelf
                        right now. Only confirm what you have actually got.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" loading={confirming} onClick={confirmAllInStock}>
                          {confirming ? 'Confirming…' : 'Yes, all still in stock'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={confirming}
                          onClick={() => setConfirmAsking(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {confirmNote && (
                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {confirmNote}
                    </p>
                  )}
                </Card>
              )}

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

                  {mode === 'search' && !selectedDrug && (
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
                        Can&apos;t find it?{' '}
                        <button
                          type="button"
                          onClick={() => setMode('new')}
                          className="cursor-pointer font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                        >
                          Add a new drug
                        </button>
                      </p>
                    </div>
                  )}

                  {mode === 'search' && selectedDrug && (
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

                      <AddOnFields
                        brand={brand}
                        onBrandChange={setBrand}
                        brandSuggestions={selectedDrug.brandNames}
                        expiryDate={expiryDate}
                        onExpiryChange={setExpiryDate}
                        quantity={quantity}
                        level={level}
                        onLevelChange={setLevel}
                        onQuantityChange={setQuantity}
                      />

                      <Button type="submit" loading={adding} className="w-full">
                        {adding ? 'Adding…' : 'Add to inventory'}
                      </Button>
                    </form>
                  )}

                  {mode === 'new' && (
                    <form onSubmit={submitAdd} className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setMode('search')}
                        className="cursor-pointer text-xs font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                      >
                        ← Back to search
                      </button>

                      <Field label="Generic name" htmlFor="newGenericName">
                        <Input
                          id="newGenericName"
                          value={newGenericName}
                          onChange={(e) => setNewGenericName(e.target.value)}
                          placeholder="e.g. Betamethasone"
                          required
                          autoComplete="off"
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Dosage form" htmlFor="newForm">
                          <Select id="newForm" value={newForm} onChange={(e) => setNewForm(e.target.value as DrugFormValue)}>
                            {DRUG_FORMS.map((f) => (
                              <option key={f} value={f}>
                                {f.charAt(0) + f.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Strength" htmlFor="newStrength">
                          <Input
                            id="newStrength"
                            value={newStrength}
                            onChange={(e) => setNewStrength(e.target.value)}
                            placeholder="e.g. 500 mg"
                            required
                            autoComplete="off"
                          />
                        </Field>
                      </div>

                      <Field
                        label="Size"
                        hint={formUsesPackSize(newForm) ? '(e.g. 30 g tube, 100 ml bottle)' : '(optional)'}
                        htmlFor="newPackSize"
                      >
                        <Input
                          id="newPackSize"
                          value={newPackSize}
                          onChange={(e) => setNewPackSize(e.target.value)}
                          placeholder="e.g. 30 g tube"
                          autoComplete="off"
                        />
                      </Field>

                      <Field label="What is it for?" hint="(optional)" htmlFor="newCategory">
                        <Select
                          id="newCategory"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                        >
                          <option value="">Not sure — leave blank</option>
                          {DRUG_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Helps patients recognise the drug. Only set this if you&apos;re sure.
                        </p>
                      </Field>

                      <AddOnFields
                        brand={brand}
                        onBrandChange={setBrand}
                        expiryDate={expiryDate}
                        onExpiryChange={setExpiryDate}
                        quantity={quantity}
                        level={level}
                        onLevelChange={setLevel}
                        onQuantityChange={setQuantity}
                      />

                      <Button type="submit" loading={adding} className="w-full">
                        {adding ? 'Adding…' : 'Add to inventory'}
                      </Button>
                    </form>
                  )}
                </Card>
              )}

              <div className="mt-6">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your drugs ({inventoryTotal})</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{inStockCount} in stock</p>
                </div>

                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No drugs listed yet — tap &ldquo;Add drug&rdquo; above to add your first one.
                  </p>
                ) : (
                  <ul className="stagger space-y-2">
                    {items.map((item) => (
                      <li key={item.id}>
                        <Card padded={false} className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium text-gray-900 dark:text-gray-100">
                              <span className="truncate">{drugLabel(item.drug)}</span>
                              {/* Read-only here. Prescription status is a
                                  regulatory fact about the medicine, not
                                  something a shop sets about its own
                                  stock — an admin owns it. */}
                              <DispensingBadge value={item.drug.dispensing} short className="shrink-0" />
                            </p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                              {item.brand ?? (item.drug.brandNames.length > 0 ? item.drug.brandNames.join(', ') : null) ?? 'No brand noted'}
                            </p>
                            {item.expiryDate && (
                              <p className={`text-xs ${isExpired(item.expiryDate) ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {isExpired(item.expiryDate) ? 'Expired ' : 'Expires '}
                                {new Date(item.expiryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                            <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                              Qty:
                              <input
                                key={item.quantity}
                                type="number"
                                min={0}
                                defaultValue={item.quantity ?? ''}
                                placeholder="—"
                                onBlur={(e) => updateQuantity(item, e.target.value)}
                                className="w-16 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-900 outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                              />
                            </label>
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

                <LoadMore
                  shown={items.length}
                  total={inventoryTotal}
                  hasMore={items.length < inventoryTotal}
                  loading={loadingInventory}
                  onLoadMore={loadMoreInventory}
                  noun="drugs"
                />
              </div>
            </>
          )}

          {tab === 'searches' && (
            <div>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                Recent patient searches in {searchScope ?? (pharmacy.lga ? `${pharmacy.lga} LGA` : stateLabel(pharmacy.state))}{' '}
                — see what&apos;s in local demand.
              </p>
              {!searches ? (
                <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading…</p>
              ) : searches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  No searches logged in your area yet.
                </p>
              ) : (
                <ul className="stagger space-y-2">
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

          {tab === 'reservations' && (
            <>
              <OwnerReservations reservations={reservations} onChanged={() => loadReservations()} />
              {reservations && reservations.length > 0 && (
                <LoadMore
                  shown={reservations.length}
                  hasMore={reservationCursor !== null}
                  loading={loadingReservations}
                  onLoadMore={loadMoreReservations}
                  noun="reservations"
                />
              )}
            </>
          )}

          {tab === 'bulk' && <BulkUploadPanel onImported={load} itemCount={inventoryTotal} />}

          {/* The rating lives on the overview now — this page is for
              working the stock list, and a score is something to check on
              rather than to be met by while doing it. */}
          <StaffNumbersCard />

          <DeleteOutletCard pharmacy={pharmacy} />
        </>
      )}
      </div>
      <SiteFooter />
    </div>
  )
}

// useSearchParams needs a Suspense boundary, same as the login and register
// pages.
export default function PharmacyDashboardPage() {
  return (
    <Suspense>
      <PharmacyDashboard />
    </Suspense>
  )
}
