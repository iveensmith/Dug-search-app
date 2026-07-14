'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import SearchBox from '@/components/SearchBox'
import {
  type ActiveRoute,
  type DrugSuggestion,
  type PharmacyResult,
  drugLabel,
  directionsUrl,
  UYO_CENTER,
} from '@/lib/types'

// Leaflet touches `window` — client-only
const ResultsMap = dynamic(() => import('@/components/ResultsMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-gray-400">Loading map…</div>
  ),
})

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

export default function Home() {
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
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

  /** Current position if known, otherwise ask the browser (may show the permission prompt). */
  async function ensureLocation(timeoutMs = 6000): Promise<Pos | null> {
    if (userPosRef.current) return userPosRef.current
    return applyPosition(await getPosition(timeoutMs))
  }

  // Quiet attempt on load so the first search can already be location-aware
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const pos = await getPosition(8000)
      if (!cancelled) applyPosition(pos)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  async function searchDrug(drug: DrugSuggestion) {
    const label = drugLabel(drug)
    lastDrugRef.current = drug
    setState({ kind: 'loading', label })
    setRoute(null)
    setRouteError('')

    // Wait briefly for the location prompt so results sort from the user, not the fallback
    const pos = await ensureLocation()
    const params = new URLSearchParams({ drugId: drug.id, q: label })
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

  async function logNoMatch(query: string) {
    lastDrugRef.current = null // nothing to re-sort if location arrives later
    setState({ kind: 'no-match', query })
    // fire-and-forget: records the coverage gap
    const params = new URLSearchParams({ q: query })
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
      if (lastDrugRef.current) {
        await searchDrug(lastDrugRef.current)
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
      const from = (await ensureLocation()) ?? UYO_CENTER
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
    if (!userPos || resortedRef.current) return
    resortedRef.current = true
    const timer = setTimeout(() => {
      if (lastDrugRef.current) searchDrug(lastDrugRef.current)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos])

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
  const mapCenter = userPos ?? UYO_CENTER

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-8">
      <header className="py-6 text-center">
        <h1 className="text-2xl font-bold text-emerald-700">DrugFinder Uyo</h1>
        <p className="mt-1 text-sm text-gray-600">
          Find which pharmacies near you have your medicine in stock
        </p>
      </header>

      <SearchBox onSelect={searchDrug} onNoMatch={logNoMatch} />

      {userPos ? (
        <p className="mt-2 text-center text-xs text-emerald-700">
          📍 Using your location — distances and directions start from where you are
        </p>
      ) : locationDenied ? (
        <div className="mt-2 text-center text-xs text-gray-500">
          <p>
            Location is off — measuring from Uyo city centre.{' '}
            <button
              onClick={enableLocation}
              disabled={locating}
              className="font-medium text-emerald-700 underline disabled:opacity-50"
            >
              {locating ? 'Getting your location…' : 'Use my location'}
            </button>
          </p>
          {locationHint && <p className="mt-1 text-amber-700">{locationHint}</p>}
        </div>
      ) : null}

      <main className="mt-4 flex-1">
        {state.kind === 'idle' && (
          <p className="mt-12 text-center text-gray-500">
            Search by generic name (e.g. <span className="font-medium">Paracetamol</span>) or brand
            (e.g. <span className="font-medium">Panadol</span>)
          </p>
        )}

        {state.kind === 'loading' && (
          <p className="mt-12 text-center text-gray-500">Searching pharmacies…</p>
        )}

        {state.kind === 'no-match' && (
          <div className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="font-medium text-amber-800">
              No drug matching “{state.query}” is in our list yet.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Try the generic name, or check the spelling. We add new drugs regularly.
            </p>
          </div>
        )}

        {state.kind === 'results' && results.length === 0 && (
          <div className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="font-medium text-amber-800">
              No pharmacy nearby currently has {state.label} in stock.
            </p>
            <p className="mt-1 text-sm text-amber-700">Stock changes daily — check back soon.</p>
          </div>
        )}

        {state.kind === 'results' && results.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{results.length}</span>{' '}
                {results.length === 1 ? 'pharmacy has' : 'pharmacies have'} {state.label}
              </p>
              <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm md:hidden">
                <button
                  onClick={() => setView('list')}
                  className={`px-4 py-1.5 font-medium ${view === 'list' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`px-4 py-1.5 font-medium ${view === 'map' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  Map
                </button>
              </div>
            </div>

            {routeError && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {routeError}
              </p>
            )}

            {route && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-emerald-900">
                    {route.pharmacyName}
                  </p>
                  <p className="text-xs text-emerald-800">
                    {route.distanceKm.toFixed(1)} km · ~{route.durationMin} min drive
                    {!userPos ? ' from Uyo city centre' : ' from your location'}
                  </p>
                  <a
                    href={directionsUrl(route.toLat, route.toLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-emerald-700 underline"
                  >
                    Voice navigation (opens Google Maps)
                  </a>
                </div>
                <button
                  onClick={() => setRoute(null)}
                  aria-label="Clear route"
                  className="shrink-0 rounded-full p-2 text-emerald-700 hover:bg-emerald-100"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              </div>
            )}

            <div className="md:grid md:grid-cols-2 md:gap-4">
              <ul className={`space-y-3 ${view === 'map' ? 'hidden md:block' : ''}`}>
                {results.map((r) => (
                  <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        <p className="text-sm text-gray-600">{r.address}</p>
                        <p className="mt-0.5 text-xs text-gray-500">☎ {r.phone}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {r.distanceKm.toFixed(1)} km
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => showRoute(r)}
                        disabled={routeBusyId === r.id}
                        className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-60"
                      >
                        {routeBusyId === r.id ? 'Loading route…' : 'Directions'}
                      </button>
                      <a
                        href={`tel:${r.phone.replace(/\s/g, '')}`}
                        onClick={(e) => handleCall(e, r.phone)}
                        className="flex-1 rounded-lg border border-emerald-600 px-3 py-2 text-center text-sm font-semibold text-emerald-700 active:bg-emerald-50"
                      >
                        {copiedPhone === r.phone ? 'Number copied ✓' : 'Call'}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>

              <div
                className={`h-[60dvh] overflow-hidden rounded-xl border border-gray-200 md:sticky md:top-4 md:h-[70dvh] ${view === 'list' ? 'hidden md:block' : ''}`}
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

      <footer className="mt-8 space-y-2 text-center text-xs text-gray-400">
        <p>
          <Link href="/prescriptions" className="font-medium text-emerald-700 underline">
            Confused by a prescription? Ask a licensed pharmacist
          </Link>
        </p>
        <p>
          <Link href="/pharmacy" className="underline">
            Own a pharmacy? Register here
          </Link>
        </p>
      </footer>
    </div>
  )
}
