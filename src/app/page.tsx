'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import SearchBox from '@/components/SearchBox'
import { type ActiveRoute, type DrugSuggestion, type PharmacyResult, drugLabel, directionsUrl } from '@/lib/types'
import { NIGERIAN_STATES, type NigerianStateValue, isValidState, matchStateName, stateCenter, stateLabel } from '@/lib/states'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import HeroGraphic from '@/components/ui/HeroGraphic'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import {
  IconAlertCircle,
  IconMapPin,
  IconMessageCircle,
  IconPhone,
  IconRoute,
  IconSearch,
  IconStore,
  IconX,
} from '@/components/ui/icons'

const FEATURE_CARDS = [
  {
    icon: IconSearch,
    title: 'Find Your Medicine',
    cta: 'Search now',
    href: '#search',
  },
  {
    icon: IconMessageCircle,
    title: 'Ask a Pharmacist',
    cta: 'Chat now',
    href: '/prescriptions',
  },
  {
    icon: IconStore,
    title: 'Register Your Pharmacy',
    cta: 'Register now',
    href: '/pharmacy/register',
  },
] as const

// Leaflet touches `window` — client-only
const ResultsMap = dynamic(() => import('@/components/ResultsMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
      Loading map…
    </div>
  ),
})

const STATE_STORAGE_KEY = 'pharmafinder_state'

type Pos = { lat: number; lng: number }

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string }
  | { kind: 'results'; label: string; results: PharmacyResult[] }
  | { kind: 'no-match'; query: string }

function getPosition(timeoutMs: number): Promise<Pos | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000, enableHighAccuracy: true },
    )
  })
}

// Nominatim reverse geocode → best-guess Nigerian state, purely to pre-fill
// the picker. Never blocks search — the user can always override it.
async function detectStateFromPosition(pos: Pos): Promise<NigerianStateValue | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`,
    )
    const data = await res.json()
    const stateName: string | undefined = data?.address?.state
    return stateName ? matchStateName(stateName) : null
  } catch {
    return null
  }
}

export default function Home() {
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const [selectedState, setSelectedState] = useState<NigerianStateValue | null>(null)
  const [detectingState, setDetectingState] = useState(true)
  const [userPos, setUserPos] = useState<Pos | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [locationHint, setLocationHint] = useState('')
  const [locating, setLocating] = useState(false)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [route, setRoute] = useState<ActiveRoute | null>(null)
  const [routeBusyId, setRouteBusyId] = useState<string | null>(null)
  const [routeError, setRouteError] = useState('')
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)

  const userPosRef = useRef<Pos | null>(null)
  const lastDrugRef = useRef<DrugSuggestion | null>(null)
  const resortedRef = useRef(false)

  function applyPosition(pos: Pos | null): Pos | null {
    if (pos) {
      userPosRef.current = pos
      setUserPos(pos)
      setLocationDenied(false)
      setLocationHint('')
    } else {
      setLocationDenied(true)
    }
    return pos
  }

  function chooseState(value: NigerianStateValue) {
    setSelectedState(value)
    localStorage.setItem(STATE_STORAGE_KEY, value)
  }

  /** Current position if known, otherwise ask the browser (may show the permission prompt). */
  async function ensureLocation(timeoutMs = 6000): Promise<Pos | null> {
    if (userPosRef.current) return userPosRef.current
    return applyPosition(await getPosition(timeoutMs))
  }

  // Work out which state to start with: saved account preference, then a
  // remembered browser choice, then a best-effort guess from geolocation.
  // Also kicks off the quiet location fetch so the first search is
  // location-aware from the start.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const stored = localStorage.getItem(STATE_STORAGE_KEY)
      if (stored && isValidState(stored)) {
        if (!cancelled) {
          setSelectedState(stored)
          setDetectingState(false)
        }
      }

      let accountState: NigerianStateValue | null = null
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.user?.state && isValidState(data.user.state)) accountState = data.user.state
      } catch {
        /* not logged in / offline — fine */
      }
      if (accountState && !cancelled) {
        setSelectedState(accountState)
        localStorage.setItem(STATE_STORAGE_KEY, accountState)
      }

      const pos = await getPosition(8000)
      if (cancelled) return
      applyPosition(pos)

      if (!stored && !accountState && pos) {
        const detected = await detectStateFromPosition(pos)
        if (detected && !cancelled) chooseState(detected)
      }
      if (!cancelled) setDetectingState(false)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  async function runSearch(drug: DrugSuggestion, forState: NigerianStateValue) {
    const label = drugLabel(drug)
    lastDrugRef.current = drug
    setState({ kind: 'loading', label })
    setRoute(null)
    setRouteError('')

    // Wait briefly for the location prompt so results sort from the user, not the fallback
    const pos = await ensureLocation()
    const params = new URLSearchParams({ drugId: drug.id, q: label, state: forState })
    if (pos) {
      params.set('lat', String(pos.lat))
      params.set('lng', String(pos.lng))
    }
    try {
      const res = await fetch(`/api/search?${params}`)
      const data = await res.json()
      setState({ kind: 'results', label, results: data.results ?? [] })
    } catch {
      setState({ kind: 'results', label, results: [] })
    }
  }

  function searchDrug(drug: DrugSuggestion) {
    if (!selectedState) return
    return runSearch(drug, selectedState)
  }

  async function logNoMatch(query: string) {
    if (!selectedState) return
    lastDrugRef.current = null // nothing to re-sort if location arrives later
    setState({ kind: 'no-match', query })
    // fire-and-forget: records the coverage gap
    const params = new URLSearchParams({ q: query, state: selectedState })
    const pos = userPosRef.current
    if (pos) {
      params.set('lat', String(pos.lat))
      params.set('lng', String(pos.lng))
    }
    fetch(`/api/search?${params}`).catch(() => {})
  }

  // "Use my location" button: explicit retry, then re-sort the active search
  async function enableLocation() {
    setLocating(true)
    setLocationHint('')
    try {
      const pos = applyPosition(await getPosition(10000))
      if (!pos) {
        setLocationHint(
          'Your browser blocked location. Allow it for this site in browser settings, then try again.',
        )
        return
      }
      if (lastDrugRef.current && selectedState) {
        await runSearch(lastDrugRef.current, selectedState)
      }
    } finally {
      setLocating(false)
    }
  }

  async function showRoute(r: PharmacyResult) {
    setRouteBusyId(r.id)
    setRouteError('')
    try {
      // Directions are the moment location matters most — ask again if needed
      const from = (await ensureLocation()) ?? (selectedState && stateCenter(selectedState))
      if (!from) return
      const params = new URLSearchParams({
        fromLat: String(from.lat),
        fromLng: String(from.lng),
        toLat: String(r.latitude),
        toLng: String(r.longitude),
      })
      const res = await fetch(`/api/route?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setRouteError('Could not load the route — use the Google Maps link instead.')
        return
      }
      setRoute({
        pharmacyId: r.id,
        pharmacyName: r.name,
        toLat: r.latitude,
        toLng: r.longitude,
        distanceKm: data.distanceKm,
        durationMin: data.durationMin,
        coords: data.coords,
      })
      setView('map') // on mobile, jump straight to the map
    } catch {
      setRouteError('Could not load the route — use the Google Maps link instead.')
    } finally {
      setRouteBusyId(null)
    }
  }

  // If permission is granted late (after a search already ran from the
  // fallback), re-run that search once so distances sort from the real spot.
  useEffect(() => {
    if (!userPos || resortedRef.current || !selectedState) return
    resortedRef.current = true
    const timer = setTimeout(() => {
      if (lastDrugRef.current) runSearch(lastDrugRef.current, selectedState)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos, selectedState])

  // tel: links only work where a dialer exists (phones). On desktops the
  // click would be silently swallowed — copy the number instead and say so.
  function handleCall(e: React.MouseEvent<HTMLAnchorElement>, phone: string) {
    const isPhoneDevice = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isPhoneDevice) return // let tel: open the dialer
    e.preventDefault()
    navigator.clipboard?.writeText(phone).catch(() => {})
    setCopiedPhone(phone)
    setTimeout(() => setCopiedPhone(null), 2500)
  }

  const results = state.kind === 'results' ? state.results : []
  const fallbackCenter = selectedState ? stateCenter(selectedState) : null
  const mapCenter = userPos ?? fallbackCenter ?? { lat: 9.082, lng: 8.6753 } // Nigeria's geographic centre — only used before a state is picked
  const selectedLabel = selectedState ? stateLabel(selectedState) : null

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10">
      {state.kind === 'idle' && (
        <>
          <section className="grid items-center gap-8 py-10 md:grid-cols-2 md:gap-10 md:py-16">
            <div>
              <p className="text-sm font-semibold italic text-emerald-700 dark:text-emerald-400">
                Nationwide Pharmacy Network
              </p>
              <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl dark:text-gray-50">
                Find Medicine In Stock Near You
              </h1>
              <p className="mt-4 max-w-md text-gray-600 dark:text-gray-400">
                Say goodbye to calling pharmacy after pharmacy. Search a drug, see who has it in
                stock nearby, and get directions or call — free, across Nigeria.
              </p>
            </div>
            <HeroGraphic />
          </section>

          <section className="grid gap-4 pb-10 sm:grid-cols-3">
            {FEATURE_CARDS.map(({ icon: Icon, title, cta, href }) => {
              const cardClass =
                'group flex flex-col items-center gap-3 rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-6 text-center transition-colors hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-500/5 dark:hover:border-emerald-700'
              const inner = (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950">
                    <Icon width={22} height={22} />
                  </div>
                  <p className="font-bold text-gray-900 dark:text-gray-50">{title}</p>
                  <span className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors group-hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950">
                    {cta}
                  </span>
                </>
              )
              return href.startsWith('#') ? (
                <a key={title} href={href} className={cardClass}>
                  {inner}
                </a>
              ) : (
                <Link key={title} href={href} className={cardClass}>
                  {inner}
                </Link>
              )
            })}
          </section>
        </>
      )}

      <Card id="search" className="mb-3 scroll-mt-20" padded={false}>
        <div className="space-y-3 p-4">
          <Field label="Searching in" htmlFor="state-picker">
            <Select
              id="state-picker"
              value={selectedState ?? ''}
              onChange={(e) => chooseState(e.target.value as NigerianStateValue)}
            >
              <option value="" disabled>
                {detectingState ? 'Detecting your state…' : 'Select your state'}
              </option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <SearchBox onSelect={searchDrug} onNoMatch={logNoMatch} disabled={!selectedState} />
        </div>
      </Card>

      {!selectedState && !detectingState && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          Pick your state above to search pharmacies there
        </p>
      )}

      {selectedState && userPos ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <IconMapPin width={14} height={14} />
          Using your location — distances and directions start from where you are
        </p>
      ) : selectedState && locationDenied ? (
        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          <p>
            Location is off — measuring from {stateLabel(selectedState)}&apos;s capital.{' '}
            <button
              onClick={enableLocation}
              disabled={locating}
              className="cursor-pointer font-medium text-emerald-700 underline underline-offset-2 disabled:opacity-50 dark:text-emerald-400"
            >
              {locating ? 'Getting your location…' : 'Use my location'}
            </button>
          </p>
          {locationHint && <p className="mt-1 text-amber-700 dark:text-amber-400">{locationHint}</p>}
        </div>
      ) : null}

      <main className="mt-5 flex-1">
        {state.kind === 'idle' && selectedState && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Search by generic name (e.g. <span className="font-medium text-gray-700 dark:text-gray-300">Paracetamol</span>) or brand
            (e.g. <span className="font-medium text-gray-700 dark:text-gray-300">Panadol</span>)
          </p>
        )}

        {state.kind === 'loading' && (
          <ul className="space-y-3" aria-label="Searching pharmacies" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="mt-2 h-3 w-3/5 rounded bg-gray-100 dark:bg-gray-800/70" />
                <div className="mt-4 h-9 rounded-lg bg-gray-100 dark:bg-gray-800/70" />
              </li>
            ))}
          </ul>
        )}

        {state.kind === 'no-match' && (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
            <IconAlertCircle className="text-amber-500 dark:text-amber-400" />
            <p className="mt-2 font-medium text-amber-800 dark:text-amber-300">
              No drug matching “{state.query}” is in our list yet.
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400/90">
              Try the generic name, or check the spelling. We add new drugs regularly.
            </p>
          </div>
        )}

        {state.kind === 'results' && results.length === 0 && (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
            <IconAlertCircle className="text-amber-500 dark:text-amber-400" />
            <p className="mt-2 font-medium text-amber-800 dark:text-amber-300">
              No pharmacy in {selectedLabel} currently has {state.label} in stock.
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400/90">Stock changes daily — check back soon.</p>
          </div>
        )}

        {state.kind === 'results' && results.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{results.length}</span>{' '}
                {results.length === 1 ? 'pharmacy has' : 'pharmacies have'} {state.label} in{' '}
                {selectedLabel}
              </p>
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-300 text-sm md:hidden dark:border-gray-700">
                <button
                  onClick={() => setView('list')}
                  className={`cursor-pointer px-4 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`cursor-pointer px-4 py-1.5 font-medium transition-colors ${view === 'map' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                >
                  Map
                </button>
              </div>
            </div>

            {routeError && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                {routeError}
              </p>
            )}

            {route && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                    {route.pharmacyName}
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-400">
                    {route.distanceKm.toFixed(1)} km · ~{route.durationMin} min drive
                    {!userPos ? ` from ${selectedLabel}'s capital` : ' from your location'}
                  </p>
                  <a
                    href={directionsUrl(route.toLat, route.toLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                  >
                    Voice navigation (opens Google Maps)
                  </a>
                </div>
                <button
                  onClick={() => setRoute(null)}
                  aria-label="Clear route"
                  className="shrink-0 cursor-pointer rounded-full p-2 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                >
                  <IconX width={14} height={14} />
                </button>
              </div>
            )}

            <div className="md:grid md:grid-cols-2 md:gap-4">
              <ul className={`space-y-4 ${view === 'map' ? 'hidden md:block' : ''}`}>
                {results.map((r) => (
                  <li key={r.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                    <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-900">
                      <IconMapPin width={36} height={36} className="text-white/90" />
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:bg-gray-950/90 dark:text-emerald-400">
                        {r.distanceKm.toFixed(1)} km away
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Pharmacy
                      </p>
                      <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{r.address}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                        <IconPhone width={12} height={12} /> {r.phone}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => showRoute(r)}
                          loading={routeBusyId === r.id}
                          className="flex-1"
                        >
                          <IconRoute width={16} height={16} />
                          {routeBusyId === r.id ? 'Loading route…' : 'Directions'}
                        </Button>
                      <a
                        href={`tel:${r.phone.replace(/\s/g, '')}`}
                        onClick={(e) => handleCall(e, r.phone)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-600/60 px-3 py-2.5 text-center text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:border-emerald-400/50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                      >
                        <IconPhone width={16} height={16} />
                        {copiedPhone === r.phone ? 'Copied ✓' : 'Call'}
                      </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div
                className={`map-tiles h-[60dvh] overflow-hidden rounded-2xl border border-gray-200 md:sticky md:top-4 md:h-[70dvh] dark:border-gray-800 ${view === 'list' ? 'hidden md:block' : ''}`}
              >
                <ResultsMap
                  results={results}
                  userPos={userPos}
                  center={mapCenter}
                  route={route}
                  onRoute={showRoute}
                />
              </div>
            </div>
          </>
        )}
      </main>
      </div>

      <SiteFooter />
    </div>
  )
}
