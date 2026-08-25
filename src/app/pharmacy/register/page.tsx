'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { NIGERIAN_STATES, type NigerianStateValue, stateCenter, stateLabel } from '@/lib/states'
import { useLgas } from '@/lib/useLgas'
import SiteHeader from '@/components/ui/SiteHeader'
import PageHeader from '@/components/ui/PageHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { PHARMACY_NAME_PATTERN, filterPharmacyNameInput } from '@/lib/nameInput'
import { IconShieldCheck, IconStore, IconUser } from '@/components/ui/icons'

type Me = { id: string; email: string | null; displayName: string | null; role: string }
type Pos = { lat: number; lng: number }

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-faint">
      Loading map…
    </div>
  ),
})

const STEPS = ['Pharmacy details', 'Pin location', 'Confirm'] as const

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
  const lgaOptions = useLgas(selectedState)
  const [selectedLga, setSelectedLga] = useState('')
  const [position, setPosition] = useState(NIGERIA_CENTER)
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeNote, setGeocodeNote] = useState('')
  const [placeQuery, setPlaceQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0) // 0 details · 1 location · 2 confirm
  const [touchedPcn, setTouchedPcn] = useState(false)

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

  // Deliberately loose: PCN premises numbers aren't a single published
  // format, so we only catch obvious typos (too short, stray characters)
  // rather than rejecting a valid number we haven't seen.
  const pcnError =
    form.pcnLicenseNumber.trim().length > 0 && form.pcnLicenseNumber.trim().length < 4
      ? 'That looks too short — copy it exactly as printed on your certificate'
      : /[^A-Za-z0-9/\- ]/.test(form.pcnLicenseNumber)
        ? 'Use only letters, numbers, spaces, / and -'
        : ''

  const detailsComplete =
    form.pharmacyName.trim().length >= 2 &&
    Boolean(selectedState) &&
    Boolean(selectedLga) &&
    form.address.trim().length >= 5 &&
    form.phone.trim().length >= 7 &&
    form.pcnLicenseNumber.trim().length >= 4 &&
    !pcnError

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function pickState(value: NigerianStateValue) {
    setSelectedState(value)
    setSelectedLga('') // LGAs belong to a state
    const center = stateCenter(value)
    if (center) {
      setPosition(center)
      setPinConfirmed(false) // moved to a fresh area — make them re-confirm the pin
    }
  }

  /**
   * Accepts either a place to look up or a pair of coordinates.
   *
   * Coordinates are here because they are the reliable path: OSM's
   * address coverage across Nigeria is thin, so a shop on a street the
   * map has never heard of can still be placed exactly by pasting what
   * Google Maps gives when you long-press a spot and copy it.
   */
  function parseCoordinates(text: string): Pos | null {
    const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/)
    if (!m) return null
    const lat = parseFloat(m[1])
    const lng = parseFloat(m[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    // Nigeria only, roughly. Coordinates the wrong way round — the most
    // common paste mistake — land outside it and are caught here rather
    // than dropping a pharmacy in the sea off Ghana.
    if (lat < 3.5 || lat > 14.5 || lng < 2 || lng > 15.5) return null
    return { lat, lng }
  }

  async function lookupPlace(rawQuery: string, { fromAddressField = false } = {}) {
    const text = rawQuery.trim()

    const coords = parseCoordinates(text)
    if (coords) {
      setPosition(coords)
      setPinConfirmed(false)
      setGeocodeNote('Moved to those coordinates — check the pin is on your building.')
      return
    }
    if (/^[-\d\s.,]+$/.test(text) && text.length > 3) {
      setGeocodeNote('That looks like coordinates but not a spot in Nigeria. Use "latitude, longitude", e.g. 5.0377, 7.9128')
      return
    }

    if (!selectedState) {
      setGeocodeNote('Select your state first, then the search will be accurate')
      return
    }
    if (text.length < 5) {
      setGeocodeNote(
        fromAddressField
          ? 'Type the street address first'
          : 'Type a place name, or paste coordinates as "latitude, longitude"',
      )
      return
    }

    setGeocoding(true)
    setGeocodeNote('')
    try {
      const q = `${text}, ${stateLabel(selectedState)}, Nigeria`
      // Through our own server, which identifies itself to the map service
      // the way its usage policy asks — a browser cannot set a User-Agent.
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data?.match) {
        setPosition({ lat: data.match.lat, lng: data.match.lng })
        setPinConfirmed(false)
        setGeocodeNote('Found a match — now move the map so the pin sits on your shopfront')
      } else {
        setGeocodeNote(
          'Not found on the map. Try a nearby landmark, or paste coordinates from Google Maps as "latitude, longitude".',
        )
      }
    } catch {
      setGeocodeNote('Could not reach the map service — move the map by hand instead')
    } finally {
      setGeocoding(false)
    }
  }

  const geocodeAddress = () => lookupPlace(form.address, { fromAddressField: true })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedState || !selectedLga) {
      setStep(0)
      setError('Please select your state and LGA')
      return
    }
    if (!pinConfirmed) {
      setStep(1)
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
          lga: selectedLga,
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
      {/* Full width so the title band runs edge to edge, with the measure
          put back on the form below it. */}
      <main className="w-full flex-1 pb-16">
      <PageHeader
        title="Add Your"
        accent="Pharmacy Outlet"
        lede="Get discovered by patients searching nearby."
      />

      <div className="mx-auto w-full max-w-2xl px-4 pt-8">

      {me === undefined && (
        <p className="py-12 text-center text-faint">Checking your account…</p>
      )}

      {me === null && (
        <Card className="animate-fade-up mx-auto max-w-md text-center">
          <IconUser width={28} height={28} className="mx-auto text-faint" />
          <p className="mt-3 font-semibold text-ink">Sign in to add your outlet</p>
          <p className="mt-1 text-sm text-muted">
            You need to be signed in before you can register a pharmacy outlet.
          </p>
          <Button className="mt-4 w-full" onClick={() => router.push('/login?next=/pharmacy/register')}>
            Log in
          </Button>
          <p className="mt-4 text-sm text-muted">
            Don&apos;t have an account?{' '}
            <Link
              href="/register?type=pharmacy&next=/pharmacy/register"
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              Create a pharmacy owner account
            </Link>
          </p>
        </Card>
      )}

      {me && me.role !== 'PHARMACY_OWNER' && (
        <Card className="animate-fade-up mx-auto max-w-md text-center">
          <IconStore width={28} height={28} className="mx-auto text-faint" />
          <p className="mt-3 font-semibold text-ink">
            This needs a pharmacy owner account
          </p>
          <p className="mt-1 text-sm text-muted">
            You&apos;re signed in as a {me.role === 'PATIENT' ? 'patient' : me.role.toLowerCase().replace('_', ' ')} —
            pharmacy outlets are managed from a separate pharmacy owner account.
          </p>
          <Button
            className="mt-4 w-full"
            onClick={() => router.push('/register?type=pharmacy&next=/pharmacy/register')}
          >
            Create a pharmacy owner account
          </Button>
          <p className="mt-4 text-sm text-muted">
            Already have one?{' '}
            <Link
              href="/login?next=/pharmacy/register"
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              Log in with it
            </Link>
          </p>
        </Card>
      )}

      {me && me.role === 'PHARMACY_OWNER' && (
        <>
      <div className="flex items-start gap-3 rounded-control border border-info bg-info-soft p-3.5 text-sm text-info-ink">
        <IconShieldCheck width={18} height={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Before you start</p>
          <p className="mt-1">
            You&apos;ll need your <strong>PCN premises registration number</strong> and your exact
            shop location. We verify the licence with the PCN register before your pharmacy shows up
            in patient searches — that usually takes <strong>2–3 working days</strong>, and you can
            track the status on your dashboard.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between text-xs font-medium">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={
                i === step
                  ? 'font-bold text-brand-ink'
                  : i < step
                    ? 'text-terracotta-700/70 dark:text-terracotta-400/70'
                    : 'text-faint'
              }
            >
              {i < step ? '✓ ' : `${i + 1}. `}
              {label}
            </span>
          ))}
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="mt-5">
        <form onSubmit={submit} className="space-y-5">
          {step === 0 && (
            <>
              <Field label="Pharmacy name" htmlFor="pharmacyName">
                <Input
                  id="pharmacyName"
                  value={form.pharmacyName}
                  onChange={(e) => set('pharmacyName', filterPharmacyNameInput(e.target.value))}
                  required
                  maxLength={120}
                  pattern={PHARMACY_NAME_PATTERN}
                  title="Letters and numbers, with & , . ' - / ( ) — and at least one letter"
                />
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

              {selectedState && (
                <Field label="Local Government Area (LGA)" htmlFor="lga">
                  <Select id="lga" value={selectedLga} onChange={(e) => setSelectedLga(e.target.value)} required>
                    <option value="" disabled>
                      {lgaOptions.length === 0
                        ? 'Loading areas…'
                        : `Select your LGA in ${stateLabel(selectedState)}`}
                    </option>
                    {lgaOptions.map((lga) => (
                      <option key={lga} value={lga}>
                        {lga}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="Street address" htmlFor="address">
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  required
                  placeholder="e.g. 25 Aka Road"
                />
              </Field>

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

              <Field
                label="PCN premises registration number"
                hint="(as printed on your certificate)"
                htmlFor="pcnLicenseNumber"
              >
                <Input
                  id="pcnLicenseNumber"
                  value={form.pcnLicenseNumber}
                  onChange={(e) => set('pcnLicenseNumber', e.target.value)}
                  onBlur={() => setTouchedPcn(true)}
                  aria-invalid={Boolean(touchedPcn && pcnError)}
                  required
                />
                {touchedPcn && pcnError ? (
                  <p className="mt-1 text-sm font-medium text-danger-ink">{pcnError}</p>
                ) : (
                  <p className="mt-1 text-xs text-faint">
                    Input the correct registration number — confirmation will be done via the PCN
                    register.
                  </p>
                )}
              </Field>

              <Button
                type="button"
                className="w-full"
                size="lg"
                disabled={!detailsComplete}
                onClick={() => {
                  setError('')
                  setStep(1)
                }}
              >
                Continue to location
              </Button>
              {!detailsComplete && (
                <p className="text-center text-xs text-faint">
                  Fill in every field above to continue.
                </p>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className="mb-1.5 text-sm font-medium text-muted">
                  Pin your exact location{' '}
                  <span className="font-normal text-faint">
                    (move the map so the pin sits on your shopfront)
                  </span>
                </p>
                <Button type="button" variant="outline" size="sm" onClick={geocodeAddress} loading={geocoding} className="mb-2">
                  {geocoding ? 'Searching…' : 'Find my address on the map'}
                </Button>

                {/* The typed way in, for anyone who would rather not drag a
                    map at all. It takes a landmark to look up, or a pair of
                    coordinates pasted straight from Google Maps — which is
                    the dependable route where OSM has never heard of the
                    street. Enter submits it without submitting the form. */}
                <div className="mb-2 flex gap-2">
                  <Input
                    id="placeQuery"
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void lookupPlace(placeQuery)
                      }
                    }}
                    placeholder="Or type a landmark, or paste 5.0377, 7.9128"
                    aria-label="Search for a place, or paste coordinates"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    loading={geocoding}
                    onClick={() => void lookupPlace(placeQuery)}
                  >
                    Go
                  </Button>
                </div>

                {geocodeNote && <p className="mb-2 text-sm text-muted">{geocodeNote}</p>}
                <div className="map-tiles h-72 overflow-hidden rounded-control border border-line-strong">
                  {/* The tick follows the map, but only when the owner moved it —
                      a programmatic recentre (picking a state, a place
                      search) must not confirm a pin on their behalf. */}
                  <LocationPicker
                    position={position}
                    onChange={(p, source) => {
                      setPosition(p)
                      if (source === 'user') setPinConfirmed(true)
                    }}
                  />
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={pinConfirmed}
                    onChange={(e) => setPinConfirmed(e.target.checked)}
                    className="h-4 w-4 accent-terracotta-600"
                  />
                  The pin is on my pharmacy
                </label>
                <p className="mt-1.5 text-xs text-faint">
                  Patients get walking and driving directions to this exact point.
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button type="button" className="flex-1" disabled={!pinConfirmed} onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <dl className="divide-y divide-gray-100 rounded-control border border-line dark:divide-gray-800">
                {[
                  ['Pharmacy', form.pharmacyName],
                  ['Area', selectedState ? `${selectedLga}, ${stateLabel(selectedState)}` : ''],
                  ['Address', form.address],
                  ['Phone', form.phone],
                  ['PCN number', form.pcnLicenseNumber],
                  ['Map pin', `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-faint">
                      {label}
                    </dt>
                    <dd className="min-w-0 break-words text-right text-sm text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="text-sm text-muted">
                Managed from{' '}
                <span className="font-medium text-ink">
                  {me.displayName ?? me.email ?? 'your account'}
                </span>
                {me.email && me.displayName ? ` (${me.email})` : ''}. We&apos;ll email you when
                verification finishes — usually 2–3 working days.
              </p>

              {error && <p className="text-sm font-medium text-danger-ink">{error}</p>}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" loading={busy} className="flex-1" size="lg">
                  {busy ? 'Submitting…' : 'Submit for verification'}
                </Button>
              </div>
            </>
          )}
        </form>
      </Card>
        </>
      )}
      </div>
      </main>
      <SiteFooter />
    </div>
  )
}
