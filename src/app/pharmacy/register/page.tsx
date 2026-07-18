'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { NIGERIAN_STATES, type NigerianStateValue, stateCenter, stateLabel } from '@/lib/states'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-gray-400">Loading map…</div>
  ),
})

// Shown until a state is picked — Nigeria's approximate geographic centre
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 }

export default function PharmacyRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    pharmacyName: '',
    address: '',
    phone: '',
    pcnLicenseNumber: '',
    ownerEmail: '',
    password: '',
  })
  const [selectedState, setSelectedState] = useState<NigerianStateValue | ''>('')
  const [position, setPosition] = useState(NIGERIA_CENTER)
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeNote, setGeocodeNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="py-6 text-center">
        <h1 className="text-2xl font-bold text-emerald-700">
          <Link href="/">PharmaFinder</Link>
        </h1>
        <p className="mt-1 text-sm text-gray-600">Register your pharmacy</p>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        After you register, our team verifies your PCN license before your pharmacy appears in
        search results. You&apos;ll see your approval status on your dashboard.
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pharmacy name</label>
          <input value={form.pharmacyName} onChange={(e) => set('pharmacyName', e.target.value)} required className={inputCls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
          <select
            value={selectedState}
            onChange={(e) => pickState(e.target.value as NigerianStateValue)}
            required
            className={inputCls}
          >
            <option value="" disabled>
              Select the state your pharmacy is in
            </option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Street address</label>
          <input
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            required
            placeholder="e.g. 25 Aka Road"
            className={inputCls}
          />
          <button
            type="button"
            onClick={geocodeAddress}
            disabled={geocoding}
            className="mt-2 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 disabled:opacity-50"
          >
            {geocoding ? 'Searching…' : 'Find address on map'}
          </button>
          {geocodeNote && <p className="mt-1 text-sm text-gray-600">{geocodeNote}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Pin your exact location <span className="font-normal text-gray-500">(drag the pin or tap the map)</span>
          </label>
          <div className="h-72 overflow-hidden rounded-xl border border-gray-300">
            <LocationPicker position={position} onChange={(p) => { setPosition(p); setPinConfirmed(true) }} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={pinConfirmed}
              onChange={(e) => setPinConfirmed(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            The pin is on my pharmacy
          </label>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pharmacy phone</label>
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
            placeholder="e.g. 0803 123 4567"
            inputMode="tel"
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">PCN license number</label>
          <input value={form.pcnLicenseNumber} onChange={(e) => set('pcnLicenseNumber', e.target.value)} required className={inputCls} />
        </div>

        <hr className="border-gray-200" />
        <p className="text-sm font-medium text-gray-900">Owner account (for logging in)</p>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} required autoComplete="email" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Password (min 8 characters)</label>
          <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} autoComplete="new-password" className={inputCls} />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Register pharmacy'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-emerald-700 underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
