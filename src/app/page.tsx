'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import SearchBox from '@/components/SearchBox'
import {
  type ActiveRoute,
  type DrugSuggestion,
  type PharmacyResult,
  type SubstituteGroup,
  drugLabel,
  directionsUrl,
  relativeTime,
} from '@/lib/types'
import { NIGERIAN_STATES, type NigerianStateValue, isValidState, matchStateName, stateCenter, stateLabel } from '@/lib/states'
import { lgasForState } from '@/lib/lgas'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import HeroGraphic from '@/components/ui/HeroGraphic'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import OpenStatusBadge from '@/components/ui/OpenStatusBadge'
import NotifyMeForm from '@/components/NotifyMeForm'
import { Field, Select } from '@/components/ui/Field'
import {
  IconAlertCircle,
  IconCheck,
  IconMapPin,
  IconMessageCircle,
  IconPhone,
  IconRoute,
  IconSearch,
  IconShieldCheck,
  IconStore,
  IconX,
} from '@/components/ui/icons'

const TRUST_BADGES = ['PCN-verified pharmacies', 'Licensed pharmacists', 'Stock kept up to date', 'Secure & private']

const QUICK_SEARCHES = ['Paracetamol', 'Amoxicillin', 'Coartem', 'Ventolin', 'Insulin']

const HOW_IT_WORKS = [
  {
    icon: IconSearch,
    title: 'Search your medicine',
    text: 'Type the drug name — we match generics and brand names as you type.',
  },
  {
    icon: IconMapPin,
    title: 'Compare nearby pharmacies',
    text: 'See verified pharmacies in your LGA that have it in stock, nearest first.',
  },
  {
    icon: IconRoute,
    title: 'Go get it',
    text: 'Get turn-by-turn directions or call ahead — no more pharmacy-hopping.',
  },
] as const

const EXAMPLE_RESULTS = [
  ['Wellspring Pharmacy', '1.2 km'],
  ['GreenCross Pharmacy', '2.3 km'],
  ['CityCare Pharmacy', '3.1 km'],
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

const STATE_STORAGE_KEY = 'mediquest_state'

type Pos = { lat: number; lng: number }

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string }
  | {
      kind: 'results'
      label: string
      drugId: string
      results: PharmacyResult[]
      substitutes: SubstituteGroup[]
      elsewhere: PharmacyResult[] // same drug, elsewhere in the state — powers the empty state
    }
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
async function detectAreaFromPosition(
  pos: Pos,
): Promise<{ state: NigerianStateValue; lga: string | null } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`,
    )
    const data = await res.json()
    const stateName: string | undefined = data?.address?.state
    const state = stateName ? matchStateName(stateName) : null
    if (!state) return null

    // Nominatim reports Nigerian LGAs inconsistently — county is the usual
    // field, city/town sometimes. Match loosely against the canonical list
    // and fall back to "not detected" rather than guessing wrong.
    const candidates = [data?.address?.county, data?.address?.city, data?.address?.town]
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.replace(/\s+(local government area|lga)$/i, '').trim().toLowerCase())
    const lga = lgasForState(state).find((l) => candidates.includes(l.toLowerCase())) ?? null
    return { state, lga }
  } catch {
    return null
  }
}

export default function Home() {
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  // Viewer's role — hides the "Add Your Pharmacy Outlet" card from accounts
  // that can't register one (patients, pharmacists, admins).
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<NigerianStateValue | null>(null)
  const [selectedLga, setSelectedLga] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false) // full state/LGA dropdowns vs the compact chip
  const selectedLgaRef = useRef('') // read inside runSearch (avoids stale closure)
  const [detectingState, setDetectingState] = useState(true)
  const [userPos, setUserPos] = useState<Pos | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [locationHint, setLocationHint] = useState('')
  const [locating, setLocating] = useState(false)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance')
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
    setSelectedLga('') // LGAs belong to a state — reset on state change
    selectedLgaRef.current = ''
  }

  function chooseLga(value: string) {
    setSelectedLga(value)
    selectedLgaRef.current = value
    setPickerOpen(false) // both parts chosen — collapse back to the chip
    // Narrow (or widen) an active search immediately
    if (lastDrugRef.current && selectedState) runSearch(lastDrugRef.current, selectedState)
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
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setViewerRole(data.user?.role ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

      if (pos && !cancelled) {
        const detected = await detectAreaFromPosition(pos)
        if (detected && !cancelled) {
          // Only override a remembered/account state when we have nothing saved
          if (!stored && !accountState) chooseState(detected.state)
          const forState = stored && isValidState(stored) ? stored : accountState ?? detected.state
          if (detected.lga && forState === detected.state) {
            setSelectedLga(detected.lga)
            selectedLgaRef.current = detected.lga
          }
        }
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
    if (selectedLgaRef.current) params.set('lga', selectedLgaRef.current)
    if (pos) {
      params.set('lat', String(pos.lat))
      params.set('lng', String(pos.lng))
    }
    try {
      const res = await fetch(`/api/search?${params}`)
      const data = await res.json()
      setState({
        kind: 'results',
        label,
        drugId: drug.id,
        results: data.results ?? [],
        substitutes: data.substitutes ?? [],
        elsewhere: data.elsewhere ?? [],
      })
    } catch {
      setState({ kind: 'results', label, drugId: drug.id, results: [], substitutes: [], elsewhere: [] })
    }
  }

  function searchDrug(drug: DrugSuggestion) {
    if (!selectedState || !selectedLgaRef.current) return
    return runSearch(drug, selectedState)
  }

  // One-tap search for the "Popular" chips: resolve the term against the
  // drug list, then run the normal search (or log the gap if unmatched).
  async function quickSearch(term: string) {
    if (!selectedState || !selectedLgaRef.current) return
    try {
      const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(term)}`)
      const json = await res.json()
      const drug: DrugSuggestion | undefined = (json.drugs ?? [])[0]
      if (drug) await runSearch(drug, selectedState)
      else await logNoMatch(term)
    } catch {
      /* network hiccup — leave the page as-is */
    }
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

  const results = useMemo(() => (state.kind === 'results' ? state.results : []), [state])
  const sortedResults = useMemo(() => {
    const sorted = [...results]
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else sorted.sort((a, b) => a.distanceKm - b.distanceKm)
    return sorted
  }, [results, sortBy])
  const fallbackCenter = selectedState ? stateCenter(selectedState) : null
  const mapCenter = userPos ?? fallbackCenter ?? { lat: 9.082, lng: 8.6753 } // Nigeria's geographic centre — only used before a state is picked
  const selectedLabel = selectedState ? stateLabel(selectedState) : null
  const areaChosen = Boolean(selectedState && selectedLga)

  // The one interactive thing that matters — rendered inside the hero while
  // idle, and above the results once a search has run.
  const searchPanel = (
    <Card
      id="search"
      className="mb-4 scroll-mt-24 shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-100 dark:shadow-black/20 dark:ring-emerald-900/40"
      padded={false}
    >
      <div className="space-y-4 p-5">
        {areaChosen && !pickerOpen ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-500/10">
            <p className="flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <IconMapPin width={16} height={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">
                Searching in{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedLga}</span>,{' '}
                {selectedLabel}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="shrink-0 cursor-pointer text-sm font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <Field label="Searching in" htmlFor="state-picker">
              <Select
                id="state-picker"
                value={selectedState ?? ''}
                onChange={(e) => chooseState(e.target.value as NigerianStateValue)}
              >
                <option value="" disabled>
                  {detectingState ? 'Detecting your location…' : 'Select your state'}
                </option>
                {NIGERIAN_STATES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedState && (
              <Field label="Area (LGA)" htmlFor="lga-picker">
                <Select id="lga-picker" value={selectedLga} onChange={(e) => chooseLga(e.target.value)} required>
                  <option value="" disabled>
                    Select your LGA in {selectedLabel}
                  </option>
                  {lgasForState(selectedState).map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}

        <SearchBox onSelect={searchDrug} onNoMatch={logNoMatch} disabled={!areaChosen} />

        <div className="pt-1">
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Popular searches
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => quickSearch(term)}
                disabled={!areaChosen}
                className="cursor-pointer rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {!detectingState && !areaChosen && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {!selectedState
              ? 'Pick your state to search pharmacies there'
              : 'Now pick your LGA — results are scoped to your area'}
          </p>
        )}
      </div>
    </Card>
  )


  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10">
      {viewerRole === 'PHARMACY_OWNER' ? (
        <Card className="animate-fade-up mx-auto mb-10 w-full max-w-md text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <IconStore width={22} height={22} />
          </span>
          <p className="mt-3 font-semibold text-gray-900 dark:text-gray-100">
            You&apos;re signed in as a pharmacy owner
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Drug search is for patients. Manage your outlet&apos;s inventory and see local demand from
            your dashboard.
          </p>
          <Link
            href="/pharmacy"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            Go to your dashboard
          </Link>
        </Card>
      ) : (
        <>
      {state.kind === 'idle' && (
        <>
          {/* Three grid children so the illustration can sit between the
              headline and the search box on mobile, while explicit
              row/column placement keeps the two-column layout on desktop
              (copy + search stacked left, illustration right). */}
          <section className="animate-fade-up grid items-center gap-y-10 py-12 md:grid-cols-2 md:gap-x-16 md:py-20">
            <div className="md:col-start-1 md:row-start-1">
              <p className="text-sm font-semibold italic text-emerald-700 dark:text-emerald-400">
                Nationwide Pharmacy Network
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl dark:text-gray-50">
                Find Medicine In Stock Near You
              </h1>
              <p className="mt-5 max-w-md leading-relaxed text-gray-600 dark:text-gray-400">
                Say goodbye to calling pharmacy after pharmacy. Search a drug, see who has it in stock
                nearby, and get directions or call — free, across Nigeria.
              </p>
            </div>

            <div className="relative pb-16 md:col-start-2 md:row-span-2 md:row-start-1 md:pb-12">
              <HeroGraphic />
              {/* Deliberately styled as a mock-up, not a live result: dashed
                  border, muted type and an explicit banner, so nobody reads
                  these placeholder names as real pharmacies. */}
              <div
                aria-hidden="true"
                className="animate-float absolute -bottom-1 left-0 w-60 select-none rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/95 p-4 shadow-lg backdrop-blur-sm sm:left-2 sm:w-64 dark:border-gray-600 dark:bg-gray-900/95"
              >
                <p className="mb-2.5 rounded-md bg-gray-200 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:bg-white/10 dark:text-gray-400">
                  Sample — not live results
                </p>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Paracetamol 500 mg</p>
                <ul className="mt-2.5 space-y-2">
                  {EXAMPLE_RESULTS.map(([name, dist]) => (
                    <li key={name} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <IconCheck width={14} height={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
                        <span className="truncate text-gray-400 dark:text-gray-500">{name}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-500">{dist}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="md:col-start-1 md:row-start-2">
              {searchPanel}

              <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                Not sure what you need?{' '}
                <Link
                  href="/prescriptions"
                  className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                >
                  Ask a pharmacist
                </Link>
              </p>

              <ul className="mt-8 grid max-w-md grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {TRUST_BADGES.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <IconShieldCheck width={16} height={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="reveal border-t border-gray-200/80 py-16 md:py-24 dark:border-gray-800/80">
            <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
              Three steps between you and your medicine.
            </p>
            <ol className="mt-10 grid gap-5 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
                <li
                  key={title}
                  className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md sm:p-7 dark:border-gray-800 dark:bg-gray-900"
                >
                  <span className="absolute right-5 top-4 text-4xl font-black text-emerald-100 dark:text-emerald-500/15">
                    {i + 1}
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Icon width={20} height={20} />
                  </span>
                  <p className="mt-5 font-bold text-gray-900 dark:text-gray-50">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{text}</p>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {state.kind !== 'idle' && searchPanel}

      {state.kind !== 'idle' &&
        (selectedState && userPos ? (
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
        ) : null)}

      <main className="mt-8 flex-1">
        {state.kind === 'idle' && selectedState && (
          <Card padded={false} className="animate-fade-in overflow-hidden">
            {(userPos || locationDenied) && (
              <>
                <div className="flex items-start gap-3.5 p-4">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      userPos
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                    }`}
                  >
                    <IconMapPin width={19} height={19} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {userPos ? 'Using your location' : 'Location is off'}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                      {userPos ? (
                        'Distances and directions start from where you are'
                      ) : (
                        <>
                          Measuring from {stateLabel(selectedState)}&apos;s capital.{' '}
                          <button
                            onClick={enableLocation}
                            disabled={locating}
                            className="cursor-pointer font-medium text-emerald-700 underline underline-offset-2 disabled:opacity-50 dark:text-emerald-400"
                          >
                            {locating ? 'Getting your location…' : 'Use my location'}
                          </button>
                        </>
                      )}
                    </p>
                    {!userPos && locationHint && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{locationHint}</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800" />
              </>
            )}
            <div className="flex items-start gap-3.5 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <IconSearch width={19} height={19} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  Search by generic name or brand
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  Try
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    Paracetamol
                  </span>
                  or
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    Panadol
                  </span>
                </p>
              </div>
            </div>
          </Card>
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
          <div className="animate-fade-up mt-10 flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
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
          <>
            <div className="animate-fade-up rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <IconAlertCircle width={22} height={22} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
                <div className="min-w-0">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    No pharmacy in {selectedLga} has {state.label} right now
                  </p>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
                    Here&apos;s what you can do instead — stock changes daily, so it&apos;s worth
                    checking back.
                  </p>
                </div>
              </div>
            </div>

            {state.elsewhere.length > 0 && (
              <div className="mt-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <IconMapPin width={15} height={15} className="text-emerald-600 dark:text-emerald-400" />
                  Available elsewhere in {selectedLabel}
                </h2>
                <ul className="space-y-2">
                  {state.elsewhere.map((r) => (
                    <li key={r.id}>
                      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {r.lga ? `${r.lga} · ` : ''}
                            {r.distanceKm.toFixed(1)} km away
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Stock updated {relativeTime(r.stockUpdatedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={`tel:${r.phone.replace(/\s/g, '')}`}
                            onClick={(e) => handleCall(e, r.phone)}
                            className="flex-1 rounded-lg border border-emerald-600/60 px-3 py-2 text-center text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 sm:flex-none dark:border-emerald-400/50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                          >
                            {copiedPhone === r.phone ? 'Copied ✓' : 'Call'}
                          </a>
                          <a
                            href={directionsUrl(r.latitude, r.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-emerald-700 sm:flex-none dark:bg-emerald-500 dark:text-emerald-950"
                          >
                            Directions
                          </a>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Call ahead before travelling — these are outside {selectedLga}.
                </p>
              </div>
            )}

            {state.substitutes.length > 0 && (
              <div className="mt-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Try this instead — same generic, different strength/form
                </h2>
                <ul className="space-y-2">
                  {state.substitutes.map((sub) => (
                    <li key={sub.drug.id}>
                      <Card className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {drugLabel(sub.drug)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {sub.results.length} {sub.results.length === 1 ? 'pharmacy' : 'pharmacies'} nearby
                            {' · nearest '}
                            {sub.results[0].distanceKm.toFixed(1)} km
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => searchDrug(sub.drug)}>
                          Search this
                        </Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <NotifyMeForm drugId={state.drugId} state={selectedState} />

            <Card className="mt-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <IconMessageCircle width={19} height={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Is there another option?
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                    A licensed pharmacist can tell you what else treats the same thing.
                  </p>
                  <Link
                    href="/prescriptions"
                    className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                  >
                    Ask a pharmacist
                  </Link>
                </div>
              </div>
            </Card>
          </>
        )}

        {state.kind === 'results' && results.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{results.length}</span>{' '}
                {results.length === 1 ? 'pharmacy has' : 'pharmacies have'} {state.label} in{' '}
                {selectedLabel}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'distance' | 'name')}
                  aria-label="Sort results by"
                  className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <option value="distance">Nearest first</option>
                  <option value="name">Name (A–Z)</option>
                </select>
                <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm md:hidden dark:border-gray-700">
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
              <ul className={`stagger space-y-4 ${view === 'map' ? 'hidden md:block' : ''}`}>
                {sortedResults.map((r) => (
                  <li key={r.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                    <div className="relative flex h-24 items-center justify-center border-b border-transparent bg-gradient-to-br from-emerald-500 to-emerald-700 dark:border-emerald-900/40 dark:from-emerald-950/80 dark:to-emerald-900/40">
                      <IconMapPin width={36} height={36} className="text-white/90 dark:text-emerald-400/70" />
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:bg-gray-950/90 dark:text-emerald-400">
                        {r.distanceKm.toFixed(1)} km away
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          Pharmacy
                        </p>
                        <div className="flex items-center gap-1.5">
                          <OpenStatusBadge open24h={r.open24h} opensAt={r.opensAt} closesAt={r.closesAt} />
                          <VerifiedBadge />
                        </div>
                      </div>
                      <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {r.address}
                        {r.lga && (
                          <span className="text-gray-400 dark:text-gray-500"> · {r.lga} LGA</span>
                        )}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                        <IconPhone width={12} height={12} /> {r.phone}
                      </p>
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        Stock updated {relativeTime(r.stockUpdatedAt)} by the pharmacy
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
                  results={sortedResults}
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
        </>
      )}
      </div>

      <SiteFooter />
    </div>
  )
}
