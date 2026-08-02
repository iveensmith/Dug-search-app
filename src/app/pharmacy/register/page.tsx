'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { NIGERIAN_STATES, type NigerianStateValue, stateCenter, stateLabel } from '@/lib/states'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { IconShieldCheck, IconUser } from '@/components/ui/icons'

type Me = { id: string; email: string | null; displayName: string | null; role: string }

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
      Loading map…
    </div>
  ),
})

// Shown until a state is picked — Nigeria's approximate geographic centre
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 }

export default function PharmacyRegisterPage() {
  const router = useRouter()
  // undefined = still checking, null = signed out
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [form, setForm] = useState({
    pharmacyName: '',
    address: '',
    phone: '',
    pcnLicenseNumber: '',
  })
  const [selectedState, setSelectedState] = useState<NigerianStateValue | ''>('')
  const [position, setPosition] = useState(NIGERIA_CENTER)
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeNote, setGeocodeNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMe(data.user ?? null)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function pickState(value: NigerianStateValue) {
    setSelectedState(value)
    const center = stateCenter(value)
    if (center) {
      setPosition(center)
      setPinConfirmed(false) // moved to a fresh area — make them re-confirm the pin
    }
  }

  async function geocodeAddress() {
    if (!selectedState) {
      setGeocodeNote('Select your state first, then the address search will be accurate')
      return
    }
    if (form.address.trim().length < 5) {
      setGeocodeNote('Type the street address first')
      return
    }
    setGeocoding(true)
    setGeocodeNote('')
    try {
      const q = `${form.address}, ${stateLabel(selectedState)}, Nigeria`
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      )
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setPosition({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        setGeocodeNote('Found a match — now drag the pin to your exact shopfront')
      } else {
        setGeocodeNote('Address not found on the map — place the pin manually below')
      }
    } catch {
      setGeocodeNote('Could not reach the map service — place the pin manually below')
    } finally {
      setGeocoding(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedState) {
      setError('Please select which state your pharmacy is in')
      return
    }
    if (!pinConfirmed) {
      setError('Please confirm the map pin is on your pharmacy before submitting')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/pharmacies/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          state: selectedState,
          latitude: position.lat,
          longitude: position.lng,
        }),
      })
      if (res.status === 401) {
        router.push('/login?next=/pharmacy/register')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Registration failed')
        return
      }
      router.push('/pharmacy')
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <header className="py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Add your pharmacy outlet</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Get discovered by patients searching nearby</p>
      </header>

      {me === undefined && (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Checking your account…</p>
      )}

      {me === null && (
        <Card className="mx-auto max-w-md text-center">
          <IconUser width={28} height={28} className="mx-auto text-gray-400 dark:text-gray-500" />
          <p className="mt-3 font-semibold text-gray-900 dark:text-gray-100">Sign in to add your outlet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            You need to be signed in before you can register a pharmacy outlet.
          </p>
          <Button className="mt-4 w-full" onClick={() => router.push('/login?next=/pharmacy/register')}>
            Log in
          </Button>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/register?next=/pharmacy/register"
              className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
            >
              Create one
            </Link>
          </p>
        </Card>
      )}

      {me && (
        <>
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
        <IconShieldCheck width={18} height={18} className="mt-0.5 shrink-0" />
        <p>
          After you register, our team verifies your PCN license before your pharmacy appears in
          search results. You&apos;ll see your approval status on your dashboard.
        </p>
      </div>

      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Pharmacy name" htmlFor="pharmacyName">
            <Input id="pharmacyName" value={form.pharmacyName} onChange={(e) => set('pharmacyName', e.target.value)} required />
          </Field>

          <Field label="State" htmlFor="state">
            <Select
              id="state"
              value={selectedState}
              onChange={(e) => pickState(e.target.value as NigerianStateValue)}
              required
            >
              <option value="" disabled>
                Select the state your pharmacy is in
              </option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Street address" htmlFor="address">
            <Input
              id="address"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              required
              placeholder="e.g. 25 Aka Road"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={geocodeAddress}
              loading={geocoding}
              className="mt-2"
            >
              {geocoding ? 'Searching…' : 'Find address on map'}
            </Button>
            {geocodeNote && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{geocodeNote}</p>}
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Pin your exact location{' '}
              <span className="font-normal text-gray-500 dark:text-gray-400">(drag the pin or tap the map)</span>
            </p>
            <div className="map-tiles h-72 overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700">
              <LocationPicker position={position} onChange={(p) => { setPosition(p); setPinConfirmed(true) }} />
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={pinConfirmed}
                onChange={(e) => setPinConfirmed(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              The pin is on my pharmacy
            </label>
          </div>

          <Field label="Pharmacy phone" htmlFor="phone">
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              required
              placeholder="e.g. 0803 123 4567"
              inputMode="tel"
            />
          </Field>

          <Field label="PCN license number" htmlFor="pcnLicenseNumber">
            <Input id="pcnLicenseNumber" value={form.pcnLicenseNumber} onChange={(e) => set('pcnLicenseNumber', e.target.value)} required />
          </Field>

          <hr className="border-gray-200 dark:border-gray-800" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The outlet will be managed from{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {me.displayName ?? me.email ?? 'your account'}
            </span>
            {me.email && me.displayName ? ` (${me.email})` : ''}.
          </p>

          {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={busy} className="w-full" size="lg">
            {busy ? 'Submitting…' : 'Add pharmacy outlet'}
          </Button>
        </form>
      </Card>
        </>
      )}
      </div>
      <SiteFooter />
    </div>
  )
}
