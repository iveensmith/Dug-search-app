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
  type CoverageResult,
  drugLabel,
  directionsUrl,
  relativeTime,
  stockFreshness,
} from '@/lib/types'
import { NIGERIAN_STATES, type NigerianStateValue, isValidState, matchStateName, stateCenter, stateLabel } from '@/lib/states'
import { loadLgas, useLgas } from '@/lib/useLgas'
import SiteHeader, { HOME_RESET_EVENT } from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import HeroGraphic from '@/components/ui/HeroGraphic'
import NetworkPulse from '@/components/NetworkPulse'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import OpenStatusBadge from '@/components/ui/OpenStatusBadge'
import RatingStars from '@/components/RatingStars'
import StockPulse from '@/components/StockPulse'
import StockLevelBadge from '@/components/StockLevelBadge'
import { dispensingClass, needsPrescription } from '@/lib/dispensing'
import RecentSearches from '@/components/RecentSearches'
import { NO_FILTERS, activeFilterCount, applyFilters, type Filters } from '@/lib/filters'
import { holdTimeLeft, type ReservationStatusValue } from '@/lib/reservations'
import CoverageResults from '@/components/CoverageResults'
import { MAX_DRUGS } from '@/lib/searchLimits'
import { Field, Select } from '@/components/ui/Field'
import {
  IconAlertCircle,
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCamera,
  IconClipboardList,
  IconClock,
  IconMapPin,
  IconMessageCircle,
  IconPhone,
  IconPill,
  IconPlus,
  IconRoute,
  IconSearch,
  IconShieldCheck,
  IconStore,
  IconUser,
  IconX,
} from '@/components/ui/icons'

// Four identical shields said nothing about which promise was which. Each
// now carries the icon for the thing it is actually about — and each is a
// claim the code keeps: the approval gate in api/pharmacies/register, the
// pharmacist accounts only an admin can create, the 24-hour decay in
// stockFreshness, and the ownership check on the prescription image route.
const TRUST_BADGES = [
  { label: 'PCN-verified pharmacies', Icon: IconStore },
  { label: 'Licensed pharmacists', Icon: IconUser },
  { label: 'Stock kept up to date', Icon: IconClock },
  { label: 'Secure & private', Icon: IconShieldCheck },
] as const

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

// Every answer here is a claim about behaviour that actually ships — the
// freshness sort lives in `sortResults`, the price answer is true because
// there is no price column at all, and both the approval gate and the LGA
// scope are in the search query in lib/geo.ts. Check the code before
// editing the copy.
const FAQ = [
  {
    q: 'How current is the stock information?',
    a: "Every result shows when its pharmacy last confirmed that item. Anything past 24 hours drops to “last confirmed” and sorts below fresher listings — it's never presented as a guarantee.",
  },
  {
    q: 'Do you show prices?',
    a: 'No. Pharmacies set their own prices and they move often, so instead patients rate each pharmacy on relative affordability after a visit — how its prices compared with others nearby. Confirm the price at the counter.',
  },
  {
    q: 'Can any shop list on MediQuest?',
    a: 'No. A premises supplies its PCN licence number at registration and stays invisible to patients until an admin approves it.',
  },
  {
    q: 'Which parts of Nigeria does it cover?',
    a: 'All 36 states and the FCT. Search is scoped to your state and LGA, so results are always pharmacies you can actually reach.',
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

// Three sheets that only exist after a tap: filters, rating, reserving.
// Most visits never open any of them, so they stay out of the download
// that stands between a patient and the search box. They render over the
// page rather than in it, so there is nothing for the server to prerender
// and no layout shift when the chunk lands.
const ResultFilters = dynamic(() => import('@/components/ResultFilters'), { ssr: false })
const RatePharmacyDialog = dynamic(() => import('@/components/RatePharmacyDialog'), { ssr: false })
const ReserveDialog = dynamic(() => import('@/components/ReserveDialog'), { ssr: false })

// Only appears when a search comes back empty.
const NotifyMeForm = dynamic(() => import('@/components/NotifyMeForm'), { ssr: false })


const STATE_STORAGE_KEY = 'mediquest_state'

type Pos = { lat: number; lng: number }

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string }
  | {
      kind: 'results'
      label: string
      drugId: string
      // The whole suggestion, carried from the pick rather than refetched:
      // its prescription status has to be on screen with the very first
      // result, and starting a list from it must not need a round trip.
      drug: DrugSuggestion
      results: PharmacyResult[]
      substitutes: SubstituteGroup[]
      elsewhere: PharmacyResult[] // same drug, elsewhere in the state — powers the empty state
    }
  | {
      kind: 'coverage'
      drugs: DrugSuggestion[]
      results: CoverageResult[]
    }
  | { kind: 'no-match'; query: string }

function getPosition(timeoutMs: number): Promise<Pos | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)

    // Our own timer as well as the option, because the option is not
    // enough: while a permission prompt sits unanswered neither callback
    // fires and the browser's timeout does not start counting. Plenty of
    // people never tap that prompt — and without this the state picker
    // reads "Detecting your location…" for as long as the page is open,
    // which is now the first thing on the panel.
    let settled = false
    const finish = (value: Pos | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs + 500)

    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => finish(null),
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
    const { lgasForState } = await loadLgas()
    const lga = lgasForState(state).find((l) => candidates.includes(l.toLowerCase())) ?? null
    return { state, lga }
  } catch {
    return null
  }
}

/**
 * The patient-facing home: hero, search, results. Rendered by app/page.tsx,
 * which guards it — a pharmacy owner never reaches this component.
 */
/**
 * The question above each step of the search panel.
 *
 * Plain questions rather than numbered steps: the order is a suggestion,
 * not a gate — somebody can type a medicine first and be asked where they
 * are afterwards, which is deliberate (see needsArea). Numbers would
 * promise a sequence the panel does not actually enforce.
 */
function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{children}</p>
  )
}

export default function PatientHome() {
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  // Viewer's role — hides the "Add Your Pharmacy Outlet" card from accounts
  // that can't register one (patients, pharmacists, admins).
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  // Distinguishes "signed out" from "not asked yet" — without it the
  // owner CTA would flash on screen for a signed-in patient and vanish.
  const [viewerLoaded, setViewerLoaded] = useState(false)
  const [selectedState, setSelectedState] = useState<NigerianStateValue | null>(null)
  const [selectedLga, setSelectedLga] = useState('')
  const lgaOptions = useLgas(selectedState)
  const [pickerOpen, setPickerOpen] = useState(false) // full state/LGA dropdowns vs the compact chip
  const selectedLgaRef = useRef('') // read inside runSearch (avoids stale closure)
  const [detectingState, setDetectingState] = useState(true)
  const [userPos, setUserPos] = useState<Pos | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [locationHint, setLocationHint] = useState('')
  const [locating, setLocating] = useState(false)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [sortBy, setSortBy] = useState<'fresh' | 'distance' | 'rating'>('fresh')
  const [route, setRoute] = useState<ActiveRoute | null>(null)
  const [routeBusyId, setRouteBusyId] = useState<string | null>(null)
  const [routeError, setRouteError] = useState('')
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const [rating, setRating] = useState<{ id: string; name: string } | null>(null)
  // Open reservations the signed-in patient already has for the drug on
  // screen, keyed by pharmacy — so a card shows "Reserved" instead of
  // offering to reserve the same thing twice.
  const [reserved, setReserved] = useState<
    Record<string, { id: string; status: string; readyAt: string | null }>
  >({})
  const [reserving, setReserving] = useState<{ id: string; name: string } | null>(null)
  // Same dialog as `rating`, but opened by us rather than tapped — kept
  // separate so the two can't collide mid-flow.
  const [ratingPrompt, setRatingPrompt] = useState<{ id: string; name: string } | null>(null)
  const [collectingId, setCollectingId] = useState<string | null>(null)
  // The medicines being searched for together. Empty is the normal case
  // and means the ordinary one-medicine search — list mode is opt-in, so
  // picking a drug never quietly starts building a list nobody asked for.
  const [basket, setBasket] = useState<DrugSuggestion[]>([])
  const [coverageLoading, setCoverageLoading] = useState(false)
  // Set when someone searched before choosing an area, so the picker can
  // say why it just appeared instead of seeming to interrupt them.
  const [needsArea, setNeedsArea] = useState(false)
  // Collapsed once there are results to read; see compactPanel.
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filterDraft, setFilterDraft] = useState<Filters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  // A drug picked before an area was chosen — searched the moment one is.
  const pendingDrugRef = useRef<DrugSuggestion | null>(null)
  const userPosRef = useRef<Pos | null>(null)
  const lastDrugRef = useRef<DrugSuggestion | null>(null)
  const resortedRef = useRef(false)
  const emptyRouteRef = useRef<HTMLDivElement>(null)

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
    setNeedsArea(false)
    if (!selectedState) return
    // Whatever they tried to search before they had an area, run it now —
    // being asked for your LGA should cost you the question, not the
    // drug name you already typed.
    const pending = pendingDrugRef.current
    pendingDrugRef.current = null
    if (pending) {
      void searchDrug(pending)
      return
    }
    // Otherwise narrow (or widen) an active search immediately
    if (lastDrugRef.current) runSearch(lastDrugRef.current, selectedState)
  }

  /**
   * Fills both selects from the phone's own GPS.
   *
   * The page already guesses an area quietly on load, but a guess that
   * failed left no way to ask again except the two dropdowns — 36 states
   * and up to 774 LGAs of scrolling on a phone.
   */
  async function detectMyArea() {
    setLocating(true)
    setLocationHint('')
    try {
      const pos = applyPosition(await getPosition(10000))
      if (!pos) {
        setLocationHint('Your browser blocked location — pick your state below instead.')
        return
      }
      const detected = await detectAreaFromPosition(pos)
      if (!detected) {
        setLocationHint("Couldn't work out your area — pick it below.")
        return
      }
      chooseState(detected.state)
      if (detected.lga) chooseLga(detected.lga)
      else setLocationHint(`Found ${stateLabel(detected.state)} — now pick your LGA.`)
    } finally {
      setLocating(false)
    }
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
        if (cancelled) return
        setViewerRole(data.user?.role ?? null)
        setViewerLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setViewerLoaded(true)
      })
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
    setPanelExpanded(false)
    // The hero comes off the page when results replace it, so the
    // document gets shorter under a scroll position that does not move —
    // and a patient who searched from halfway down was left looking at
    // the footer, below the answers they asked for. Collapsing the panel
    // made the drop bigger, but the fault was always there.
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        drug,
        results: data.results ?? [],
        substitutes: data.substitutes ?? [],
        elsewhere: data.elsewhere ?? [],
      })
      void loadReservations(drug.id)
    } catch {
      setState({
        kind: 'results',
        label,
        drugId: drug.id,
        drug,
        results: [],
        substitutes: [],
        elsewhere: [],
      })
    }
  }

  /**
   * Reloads which pharmacies this patient already has an open reservation
   * with for the drug on screen. Runs after every search; a 401 (signed
   * out, or not a patient account) just means no reservations to show.
   */
  async function loadReservations(drugId: string) {
    setReserved({})
    try {
      // Ask only about the drug on screen. This used to pull the patient's
      // reservations and filter client-side, which quietly stopped finding
      // older open ones once the endpoint started paging.
      const res = await fetch(`/api/reservations?drugId=${encodeURIComponent(drugId)}&open=true`)
      if (!res.ok) return
      const data = await res.json()
      const open: Record<string, { id: string; status: string; readyAt: string | null }> = {}
      for (const r of data.reservations ?? []) {
        open[r.pharmacy.id] = { id: r.id, status: r.status, readyAt: r.readyAt ?? null }
      }
      setReserved(open)
    } catch {
      /* leave the buttons in their default state */
    }
  }

  /** Patient confirming at the card that they walked out with the drug. */
  async function markObtained(pharmacyId: string, pharmacyName: string) {
    const entry = reserved[pharmacyId]
    if (!entry) return
    setCollectingId(entry.id)
    try {
      const res = await fetch(`/api/reservations/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COLLECTED' }),
      })
      if (!res.ok) return
      setReserved((prev) => {
        const next = { ...prev }
        delete next[pharmacyId]
        return next
      })
      // Just back from the counter is the one moment they can actually
      // answer all four questions. The dialog drops itself if they've
      // already rated this pharmacy.
      setRatingPrompt({ id: pharmacyId, name: pharmacyName })
    } catch {
      /* the reservations page is the fallback place to close it */
    } finally {
      setCollectingId(null)
    }
  }

  function searchDrug(drug: DrugSuggestion) {
    // No area yet: hold the pick and open the picker rather than doing
    // nothing. Previously the whole box was disabled until both selects
    // were answered, so the first thing a new visitor met was a dead
    // primary input — the single worst thing on a page whose job is to
    // get a drug name typed into it.
    if (!selectedState || !selectedLgaRef.current) {
      pendingDrugRef.current = drug
      setPickerOpen(true)
      setNeedsArea(true)
      return
    }
    setNeedsArea(false)
    // In list mode a pick joins the list instead of replacing it. Picking
    // something already on the list is a no-op rather than a duplicate.
    if (basket.length > 0) {
      if (basket.some((d) => d.id === drug.id)) return
      const next = [...basket, drug].slice(0, MAX_DRUGS)
      setBasket(next)
      return runCoverageSearch(next, selectedState)
    }
    return runSearch(drug, selectedState)
  }

  /**
   * Starts a list from the medicine already on screen, so the patient
   * never retypes what they just searched for.
   */
  function startList(drug: DrugSuggestion) {
    setBasket([drug])
    setState({ kind: 'coverage', drugs: [drug], results: [] })
    // The box is above the results; bring it back into view and put the
    // cursor in it, or "add another" leaves them looking at nothing.
    // Expanded first — focusing an input that is not rendered does
    // nothing, and the collapsed summary has no input at all.
    setPanelExpanded(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => searchInputRef.current?.focus(), 350)
  }

  function removeFromList(drugId: string) {
    const next = basket.filter((d) => d.id !== drugId)
    setBasket(next)
    if (!selectedState) return
    if (next.length === 0) {
      setState({ kind: 'idle' })
      return
    }
    // One medicine left is not a coverage question any more — the ordinary
    // search answers it better, with substitutes, filters and reserving.
    if (next.length === 1) {
      setBasket([])
      void runSearch(next[0], selectedState)
      return
    }
    void runCoverageSearch(next, selectedState)
  }

  /** Which nearby pharmacies cover the most of the list, in one trip. */
  async function runCoverageSearch(drugs: DrugSuggestion[], forState: NigerianStateValue) {
    setPanelExpanded(false)
    // Same reason as runSearch.
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setState({ kind: 'coverage', drugs, results: [] })
    setRoute(null)
    setRouteError('')
    setCoverageLoading(true)
    const pos = await ensureLocation()
    const params = new URLSearchParams({
      drugIds: drugs.map((d) => d.id).join(','),
      state: forState,
    })
    if (selectedLgaRef.current) params.set('lga', selectedLgaRef.current)
    if (pos) {
      params.set('lat', String(pos.lat))
      params.set('lng', String(pos.lng))
    }
    try {
      const res = await fetch(`/api/search/multi?${params}`)
      const data = await res.json()
      setState({ kind: 'coverage', drugs, results: data.results ?? [] })
    } catch {
      setState({ kind: 'coverage', drugs, results: [] })
    } finally {
      setCoverageLoading(false)
    }
  }

  // One-tap search for the "Popular" chips: resolve the term against the
  // drug list, then run the normal search (or log the gap if unmatched).
  async function quickSearch(term: string) {
    try {
      const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(term)}`)
      const json = await res.json()
      const drug: DrugSuggestion | undefined = (json.drugs ?? [])[0]
      // Through searchDrug, not runSearch, so tapping a chip without an
      // area asks for one and then searches — the same as typing does.
      if (drug) await searchDrug(drug)
      else if (selectedState && selectedLgaRef.current) await logNoMatch(term)
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

  // The header can't navigate to "/" when we're already there, so it asks
  // the page to clear the search and show the hero again.
  useEffect(() => {
    function reset() {
      setState({ kind: 'idle' })
      setRoute(null)
      setRouteError('')
      lastDrugRef.current = null
    }
    window.addEventListener(HOME_RESET_EVENT, reset)
    return () => window.removeEventListener(HOME_RESET_EVENT, reset)
  }, [])

  // In the empty state the map renders below the "elsewhere" list, so bring
  // it into view once a route resolves.
  useEffect(() => {
    if (!route || !emptyRouteRef.current) return
    emptyRouteRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [route])

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

  const allResults = useMemo(() => (state.kind === 'results' ? state.results : []), [state])
  const results = useMemo(() => applyFilters(allResults, filters), [allResults, filters])
  const sortedResults = useMemo(() => {
    const sorted = [...results]
    if (sortBy === 'rating') sorted.sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))
    else if (sortBy === 'fresh')
      // Freshest confirmation wins; distance breaks ties
      sorted.sort(
        (a, b) =>
          new Date(b.stockUpdatedAt).getTime() - new Date(a.stockUpdatedAt).getTime() ||
          a.distanceKm - b.distanceKm,
      )
    else sorted.sort((a, b) => a.distanceKm - b.distanceKm)
    return sorted
  }, [results, sortBy])
  const fallbackCenter = selectedState ? stateCenter(selectedState) : null
  const mapCenter = userPos ?? fallbackCenter ?? { lat: 9.082, lng: 8.6753 } // Nigeria's geographic centre — only used before a state is picked
  const selectedLabel = selectedState ? stateLabel(selectedState) : null
  const areaChosen = Boolean(selectedState && selectedLga)

  /**
   * What the panel has been asked, in one line.
   *
   * Used only once results exist, where the full panel is mostly
   * restating a question that has already been answered — and on a phone
   * it pushes the answers below the fold, which is the one thing a
   * search result must never do.
   */
  const askedFor =
    state.kind === 'results'
      ? state.label
      : state.kind === 'coverage'
        ? state.drugs.map(drugLabel).join(', ')
        : state.kind === 'no-match'
          ? state.query
          : state.kind === 'loading'
            ? state.label
            : ''

  // Expanded whenever the panel is being used rather than merely
  // reporting: while adding to a list, while we are asking for an area,
  // and whenever the patient opens it themselves.
  const panelOpen = panelExpanded || needsArea || pickerOpen || basket.length > 0

  const compactPanel = (
    <button
      type="button"
      onClick={() => setPanelExpanded(true)}
      className="mb-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-emerald-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-700"
    >
      <span className="flex shrink-0 items-center justify-center rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
        <IconSearch width={16} height={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">
          {askedFor || 'New search'}
        </span>
        {selectedLabel && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <IconMapPin width={12} height={12} className="shrink-0" />
            <span className="truncate">
              {selectedLga ? `${selectedLabel} · ${selectedLga}` : selectedLabel}
            </span>
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
        Change
      </span>
    </button>
  )

  // The one interactive thing that matters — rendered inside the hero while
  // idle, and above the results once a search has run.
  const searchPanel = (
    <Card
      id="search"
      className="mb-4 scroll-mt-24 shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-100 dark:shadow-black/20 dark:ring-emerald-900/40"
      padded={false}
    >
      <div className="space-y-4 p-5">
        {/* The panel is two questions and one answer, in that order. It
            used to be a row of controls, which said nothing about what
            the app is for — the whole product is "which shop near me has
            this", and the shape of the box should be that sentence. */}
        <StepLabel>Where are you?</StepLabel>

        {areaChosen && !pickerOpen ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-500/10">
            <p className="flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <IconMapPin width={16} height={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              {/* Broad to narrow, matching the order the pickers ask in. */}
              <span className="truncate">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedLabel}</span>
                <span className="mx-1.5 text-gray-400 dark:text-gray-500">·</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedLga}</span>
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
            {/* Said only when the picker opened because a search needed
                it, so it reads as an answer to what they just did rather
                than as an error they caused. */}
            {needsArea && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <IconMapPin width={15} height={15} className="mt-0.5 shrink-0" />
                Almost there — tell us where you are and we&apos;ll search straight away.
              </p>
            )}

            {/* Both parts on one row from `sm` up: they are one question,
                and stacking them made a two-step form out of it. Still
                stacked on the narrowest phones, where side-by-side selects
                truncate the LGA names they exist to show. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="State" htmlFor="state-picker">
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

              <Field label="Area (LGA)" htmlFor="lga-picker">
                <Select
                  id="lga-picker"
                  value={selectedLga}
                  onChange={(e) => chooseLga(e.target.value)}
                  disabled={!selectedState}
                  required
                >
                  <option value="" disabled>
                    {!selectedState
                      ? 'Pick a state first'
                      : lgaOptions.length === 0
                        ? 'Loading areas…'
                        : `Select your LGA in ${selectedLabel}`}
                  </option>
                  {lgaOptions.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* The fast path. Answering two dropdowns means scrolling 36
                states and up to 774 LGAs on a phone; the GPS already
                knows, and until now only got a chance on page load. */}
            <button
              type="button"
              onClick={detectMyArea}
              disabled={locating}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              <IconMapPin width={15} height={15} />
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
            {locationHint && (
              <p className="text-xs text-amber-700 dark:text-amber-400">{locationHint}</p>
            )}
            {!needsArea && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Or skip this — search a medicine and we&apos;ll ask afterwards.
              </p>
            )}
          </>
        )}

        {/* The list, when there is one. Above the box because it is what
            the next pick joins — and every chip removable, since a
            prescription typed wrong is the normal way this goes astray. */}
        {basket.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              Medicines you need ({basket.length})
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {basket.map((d) => (
                <li key={d.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-3 pr-1 text-xs font-semibold text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100">
                    {drugLabel(d)}
                    <button
                      type="button"
                      onClick={() => removeFromList(d.id)}
                      aria-label={`Remove ${drugLabel(d)} from the list`}
                      className="cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                    >
                      <IconX width={12} height={12} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-300/80">
              {basket.length >= MAX_DRUGS
                ? `That's the most we can search at once.`
                : 'Add the rest below — we\'ll show which pharmacies have the most of them.'}
            </p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
          <StepLabel>
            {basket.length > 0 ? 'Add another medicine' : 'What medicine do you need?'}
          </StepLabel>

          <SearchBox
            onSelect={searchDrug}
            onNoMatch={logNoMatch}
            disabled={basket.length >= MAX_DRUGS}
            inputRef={searchInputRef}
            placeholder={basket.length > 0 ? 'Add another medicine…' : undefined}
            clearOnSelect={basket.length > 0}
            stackedAction
            actionLabel={basket.length > 1 ? 'Find these medicines' : 'Find medicine'}
            // The quick picks belong between the box and the button: they
            // are examples of what to type, so they are useless below the
            // thing that ends the task.
            footer={
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => quickSearch(term)}
                    className="cursor-pointer rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                  >
                    {term}
                  </button>
                ))}
              </div>
            }
          />

          <RecentSearches onPick={(drug) => void searchDrug(drug)} />
        </div>

      </div>
    </Card>
  )


  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10">
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

              {/* Legitimacy in the first screen, not below the fold. The
                  full four-promise card still sits further down with room
                  to explain itself; this is the compressed version, for
                  someone deciding in three seconds whether a health site
                  they have never heard of is worth typing a drug name
                  into. */}
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                {TRUST_BADGES.slice(0, 3).map(({ label, Icon }) => (
                  <li
                    key={label}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                  >
                    <Icon width={14} height={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative pb-16 md:col-start-2 md:row-span-2 md:row-start-1 md:pb-12">
              <HeroGraphic />
              {/* Was a dashed box captioned "Sample — not live results",
                  which told a first-time visitor they were looking at a
                  prototype. Now the real thing: counts and the latest
                  confirmation, straight from the database, or nothing at
                  all if there is nothing true to say yet. */}
              <NetworkPulse />
            </div>

            <div className="md:col-start-1 md:row-start-2">
              {searchPanel}

              {/* The other way in, for someone holding a slip they cannot
                  read. It sits under the search box because searching is
                  still the main act — but it was a thin one-line row, easy
                  to scroll past, and this is the path for the patients least
                  able to help themselves. Brand green, like everything
                  else — it is a different kind of help, not a different
                  product. */}
              <Link
                href="/prescriptions"
                className="group relative mt-4 block overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg sm:mt-5 sm:rounded-3xl sm:p-7 dark:border-emerald-900/50 dark:from-emerald-950/50 dark:via-gray-900 dark:to-gray-900 dark:hover:border-emerald-800"
              >
                {/* Soft light behind the corner. pointer-events-none so it
                    never sits between a thumb and the link. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10"
                />

                <div className="relative flex items-center gap-3.5 sm:items-start sm:gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-md shadow-emerald-700/25 transition-transform duration-200 group-hover:scale-105 sm:h-16 sm:w-16 sm:rounded-2xl dark:bg-emerald-500 dark:text-emerald-950 dark:shadow-emerald-500/20">
                    <IconCamera width={22} height={22} className="sm:hidden" />
                    <IconClipboardList width={26} height={26} className="hidden sm:block" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold tracking-tight text-gray-900 sm:text-xl dark:text-gray-50">
                      Not sure what you need?
                    </span>
                    {/* Two wordings, one meaning. The phone gets the short
                        one because the card is competing with the search
                        box on a 390px screen, and losing that contest is
                        the point — searching is still the main act. */}
                    <span className="mt-0.5 block text-sm leading-snug text-gray-600 sm:hidden dark:text-gray-400">
                      Tap to send a photo of your prescription — a Pharmacist will explain.
                    </span>
                    <span className="mt-1 hidden text-base leading-relaxed text-gray-600 sm:block dark:text-gray-400">
                      Send a photo of your prescription and a licensed Pharmacist will explain.
                    </span>

                    {/* Both claims are true of the page this links to: see
                        the copy on /prescriptions and the ownership check on
                        the image route. */}
                    <span className="mt-3.5 hidden flex-wrap gap-x-4 gap-y-1.5 sm:flex">
                      {['Usually answered within a few hours', 'Only you and the pharmacist see it'].map(
                        (line) => (
                          <span
                            key={line}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400"
                          >
                            <IconCheck
                              width={13}
                              height={13}
                              className="shrink-0 text-emerald-600 dark:text-emerald-400"
                            />
                            {line}
                          </span>
                        ),
                      )}
                    </span>

                    {/* A call-to-action row inside a card that is itself
                        one link is a second thing to aim at. Worth the
                        height on desktop where it reads as a button; on a
                        phone the chevron at the edge says the same in one
                        line of nothing. */}
                    <span className="mt-4 hidden items-center gap-1.5 text-sm font-semibold text-emerald-700 sm:inline-flex dark:text-emerald-400">
                      Ask a pharmacist
                      <IconChevronRight
                        width={16}
                        height={16}
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </span>
                  </span>

                  <IconChevronRight
                    width={20}
                    height={20}
                    aria-hidden="true"
                    className="shrink-0 text-emerald-600 transition-transform duration-200 group-hover:translate-x-0.5 sm:hidden dark:text-emerald-400"
                  />
                </div>
              </Link>

              {/* A quiet card, deliberately. It sits under a green
                  gradient call to action, and a second loud panel would
                  compete with the thing we actually want tapped — this is
                  reassurance you read on the way past. */}
              <div className="mt-6 rounded-3xl border border-gray-200/90 bg-white/70 p-5 backdrop-blur-sm dark:border-gray-800/90 dark:bg-gray-900/50">
                {/* One column, not two. The hero puts this card in a
                    464px-wide grid column at every desktop size, and two
                    columns inside that wrapped every label onto a second
                    line — "PCN-verified / pharmacies". A breakpoint would
                    not have caught it, because the viewport is wide even
                    when the card is not. */}
                <ul className="space-y-3">
                  {TRUST_BADGES.map(({ label, Icon }) => (
                    <li key={label} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <Icon width={16} height={16} />
                      </span>
                      <span className="min-w-0 text-sm font-semibold leading-snug text-gray-800 dark:text-gray-200">
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
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

          {/* Native <details> so the accordion works before hydration and
              stays keyboard- and screen-reader-correct for free. */}
          <section className="reveal border-t border-gray-200/80 py-16 md:py-24 dark:border-gray-800/80">
            <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              Questions
            </h2>
            <div className="mx-auto mt-10 max-w-2xl space-y-3">
              {FAQ.map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors open:border-emerald-200 dark:border-gray-800 dark:bg-gray-900 dark:open:border-emerald-800"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left font-semibold text-gray-900 marker:content-none dark:text-gray-50 [&::-webkit-details-marker]:hidden">
                    {q}
                    <IconChevronDown
                      width={20}
                      height={20}
                      className="shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180 dark:text-gray-500"
                    />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Owner recruitment — only for signed-out visitors, matching the
              header: a signed-in patient can't register a premises, so
              offering them one would be a dead end. */}
          {viewerLoaded && !viewerRole && (
            <section className="reveal pb-16 md:pb-24">
              <div className="rounded-3xl bg-emerald-600 p-8 shadow-lg shadow-emerald-600/20 sm:p-12 dark:bg-emerald-700">
                <h2 className="max-w-lg text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                  Run a pharmacy? Put your shelf on the map.
                </h2>
                <p className="mt-3.5 max-w-xl leading-relaxed text-emerald-50">
                  Free to list. Add your stock once, confirm it in a tap, and get found by patients
                  already searching for what you have.
                </p>
                {/* Colours are written out rather than taken from
                    buttonClass(): the variants there assume a light page
                    background, and on emerald their text colours collide
                    with the overrides. */}
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/pharmacy/register"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-base font-semibold text-emerald-700 shadow-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-emerald-50 hover:shadow-md active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600"
                  >
                    <IconStore width={18} height={18} />
                    Register your pharmacy
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600"
                  >
                    Already listed? Sign in
                    <IconChevronRight width={18} height={18} />
                  </Link>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {state.kind !== 'idle' && (panelOpen ? searchPanel : compactPanel)}

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

        {state.kind === 'coverage' && (
          <>
            {state.drugs.length < 2 ? (
              <Card className="text-center">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  Add a second medicine
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-600 dark:text-gray-400">
                  Search for the next thing on your prescription and we&apos;ll show which
                  pharmacies near you have the most of the list.
                </p>
              </Card>
            ) : coverageLoading ? (
              <ul className="space-y-3" aria-label="Searching pharmacies" aria-live="polite">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="mt-2 h-3 w-3/5 rounded bg-gray-100 dark:bg-gray-800/70" />
                    <div className="mt-4 h-9 rounded-lg bg-gray-100 dark:bg-gray-800/70" />
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                  {state.results.length === 0 ? (
                    <>Nothing in {selectedLabel} lists any of these.</>
                  ) : (
                    <>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {state.results.length}
                      </span>{' '}
                      {state.results.length === 1 ? 'pharmacy' : 'pharmacies'} in {selectedLabel}{' '}
                      {state.results.length === 1 ? 'has' : 'have'} at least one of your{' '}
                      {state.drugs.length} medicines
                    </>
                  )}
                </p>
                <CoverageResults
                  drugs={state.drugs}
                  results={state.results}
                  onCall={handleCall}
                  copiedPhone={copiedPhone ?? ''}
                />
              </>
            )}
          </>
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

        {/* Above both branches, because it is true whether four pharmacies
            have it or none do. Deliberately not an amber card: the empty
            state below is already one, and two stacked warnings read as
            noise. An amber rule down the side says "bring this with you"
            without competing with "nobody has it". */}
        {state.kind === 'results' && needsPrescription(state.drug.dispensing) && (
          <div className="animate-fade-up mb-4 rounded-2xl border border-gray-200 border-l-4 border-l-amber-400 bg-white p-4 dark:border-gray-800 dark:border-l-amber-500 dark:bg-gray-900">
            <p className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
              <IconAlertCircle width={16} height={16} className="shrink-0 text-amber-500 dark:text-amber-400" />
              {dispensingClass('POM')!.label}
            </p>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
              {dispensingClass('POM')!.note}
            </p>
            <Link
              href="/prescriptions"
              className="mt-2.5 inline-block text-sm font-bold text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
            >
              Don&apos;t have one? Ask a pharmacist →
            </Link>
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
                          <button
                            onClick={() => showRoute(r)}
                            disabled={routeBusyId === r.id}
                            className="flex-1 cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 sm:flex-none dark:bg-emerald-500 dark:text-emerald-950"
                          >
                            {routeBusyId === r.id ? 'Loading…' : 'Directions'}
                          </button>
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

            {routeError && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                {routeError}
              </p>
            )}

            {route && (
              <div ref={emptyRouteRef} className="mt-4 scroll-mt-24">
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
                    className="shrink-0 cursor-pointer rounded-full p-1.5 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                  >
                    <IconX width={16} height={16} />
                  </button>
                </div>
                <div className="map-tiles h-[55dvh] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                  <ResultsMap
                    results={state.elsewhere}
                    userPos={userPos}
                    center={mapCenter}
                    route={route}
                    onRoute={showRoute}
                  />
                </div>
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
                    Not sure what to do next?
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                    Speak to a licensed pharmacist for drug advice.
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
                {activeFilterCount(filters) > 0 ? ` of ${allResults.length} ` : ' '}
                {results.length === 1 ? 'pharmacy has' : 'pharmacies have'}{' '}
                <Link
                  href={`/drugs/${state.drugId}?state=${selectedState}&lga=${encodeURIComponent(selectedLga)}`}
                  className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                >
                  {state.label}
                </Link>{' '}
                in {selectedLabel}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => {
                    setFilterDraft(filters)
                    setFiltersOpen(true)
                  }}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                >
                  Filters
                  {activeFilterCount(filters) > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-700 px-1 text-xs font-bold text-white dark:bg-emerald-500 dark:text-emerald-950">
                      {activeFilterCount(filters)}
                    </span>
                  )}
                </button>
                <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm md:hidden dark:border-gray-700">
                  <button
                    onClick={() => setView('list')}
                    className={`cursor-pointer px-4 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setView('map')}
                    className={`cursor-pointer px-4 py-1.5 font-medium transition-colors ${view === 'map' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                  >
                    Map
                  </button>
                </div>
              </div>
            </div>

            {/* Offered where someone has just been shown one answer and
                may have a prescription with four more lines on it. Not on
                the empty page, where it would be a puzzle rather than an
                offer. */}
            {state.kind === 'results' && (
              <button
                type="button"
                onClick={() => startList(state.drug)}
                className="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/10"
              >
                <IconPlus width={15} height={15} />
                Need more than one? Add to a list
              </button>
            )}

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(
                [
                  ['fresh', 'Freshest stock'],
                  ['distance', 'Nearest'],
                  ['rating', 'Best rated'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  aria-pressed={sortBy === key}
                  className={`shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                    sortBy === key
                      ? 'border-emerald-600 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10'
                  }`}
                >
                  {label}
                </button>
              ))}
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

            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  No pharmacy matches those filters
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {allResults.length} {allResults.length === 1 ? 'pharmacy has' : 'pharmacies have'}{' '}
                  this in {selectedLga} without them.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setFilters(NO_FILTERS)}>
                  Clear filters
                </Button>
              </div>
            ) : (
            <div className="md:grid md:grid-cols-2 md:gap-4">
              <ul className={`stagger space-y-4 ${view === 'map' ? 'hidden md:block' : ''}`}>
                {sortedResults.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-800"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <IconStore width={24} height={24} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/pharmacies/${r.id}`}
                            className="truncate font-bold text-gray-900 transition-colors hover:text-emerald-700 dark:text-gray-50 dark:hover:text-emerald-400"
                          >
                            {r.name}
                          </Link>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-gray-500 dark:text-gray-400">
                            {r.distanceKm.toFixed(1)} km
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                          {r.address}
                          {r.lga ? ` · ${r.lga}` : ''}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <StockPulse stockUpdatedAt={r.stockUpdatedAt} />
                          <StockLevelBadge level={r.stockLevel} />
                          <VerifiedBadge />
                          <OpenStatusBadge open24h={r.open24h} opensAt={r.opensAt} closesAt={r.closesAt} />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setRating({ id: r.id, name: r.name })}
                      className="mt-3.5 flex cursor-pointer items-center gap-2.5"
                    >
                      <RatingStars value={r.ratingAvg} count={r.ratingCount} />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Rate</span>
                    </button>

                    {stockFreshness(r.stockUpdatedAt).tone === 'stale' && (
                      <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                        Not confirmed in over a day — worth calling first.
                      </p>
                    )}

                    <div className="mt-4 flex gap-2.5">
                      <a
                        href={`tel:${r.phone.replace(/\s/g, '')}`}
                        onClick={(e) => handleCall(e, r.phone)}
                        aria-label={`Call ${r.name}`}
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                      >
                        <IconPhone width={16} height={16} />
                        {copiedPhone === r.phone ? 'Copied ✓' : 'Call'}
                      </a>
                      <Link
                        href={`/pharmacies/${r.id}`}
                        className="flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                      >
                        Details
                      </Link>
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
                    </div>

                    {/* Reserve sits below the travel actions: calling and
                        getting there are what most people want, and this is
                        the follow-up for the ones who don't want to lose the
                        last pack while they travel. */}
                    {reserved[r.id] ? (
                      <div className="mt-2.5 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
                        {/* The tick belongs here, on the state, and nowhere
                            near the button. A filled green block wearing a
                            tick and the words "Medicine obtained" reads as
                            a badge saying it already happened — three
                            signals all pointing at "done" on a control
                            whose entire job is to say "not yet". */}
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          {reserved[r.id].status === 'READY' ? (
                            <>
                              <IconCheck width={14} height={14} className="shrink-0" />
                              {/* Never a bare "Held for you" once there is a
                                  deadline behind it — the time is the half
                                  of the sentence that decides whether they
                                  set off now. */}
                              Held for you
                              {holdTimeLeft(
                                reserved[r.id].status as ReservationStatusValue,
                                reserved[r.id].readyAt,
                              ) && (
                                <span className="font-bold">
                                  ·{' '}
                                  {holdTimeLeft(
                                    reserved[r.id].status as ReservationStatusValue,
                                    reserved[r.id].readyAt,
                                  )}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <IconClock width={14} height={14} className="shrink-0" />
                              Reservation sent — waiting on the pharmacy
                            </>
                          )}
                        </p>
                        {/* First person, because no status label ever
                            starts with "I've" — that one word is what
                            makes it unmistakably the patient's own claim
                            rather than the app reporting a fact. */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full bg-white/70 dark:bg-transparent"
                          loading={collectingId === reserved[r.id].id}
                          onClick={() => markObtained(r.id, r.name)}
                        >
                          <IconPill width={15} height={15} />
                          I&apos;ve picked it up
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="md"
                        className="mt-2.5 w-full"
                        onClick={() => setReserving({ id: r.id, name: r.name })}
                      >
                        <IconBookmark width={16} height={16} />
                        Reserve
                      </Button>
                    )}
                  </li>
                ))}
                <li className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30">
                  <IconAlertCircle
                    width={18}
                    height={18}
                    className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                  />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Pharmacies keep their own stock and hours up to date. Call ahead if a listing
                    hasn&apos;t been confirmed today.
                  </p>
                </li>
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
            )}
          </>
        )}
      </main>
      </div>

      {filtersOpen && (
        <ResultFilters
          draft={filterDraft}
          setDraft={setFilterDraft}
          matchCount={applyFilters(allResults, filterDraft).length}
          onApply={() => {
            setFilters(filterDraft)
            setFiltersOpen(false)
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {rating && (
        <RatePharmacyDialog
          pharmacyId={rating.id}
          pharmacyName={rating.name}
          onClose={() => setRating(null)}
          onSaved={(summary) =>
            setState((prev) =>
              prev.kind === 'results'
                ? {
                    ...prev,
                    results: prev.results.map((p) =>
                      p.id === rating.id
                        ? { ...p, ratingAvg: summary.overall, ratingCount: summary.count }
                        : p,
                    ),
                  }
                : prev,
            )
          }
        />
      )}

      {ratingPrompt && (
        <RatePharmacyDialog
          pharmacyId={ratingPrompt.id}
          pharmacyName={ratingPrompt.name}
          intro="You got your medicine — how was it?"
          skipIfRated
          onClose={() => setRatingPrompt(null)}
          onSaved={(summary) =>
            setState((prev) =>
              prev.kind === 'results'
                ? {
                    ...prev,
                    results: prev.results.map((p) =>
                      p.id === ratingPrompt.id
                        ? { ...p, ratingAvg: summary.overall, ratingCount: summary.count }
                        : p,
                    ),
                  }
                : prev,
            )
          }
        />
      )}

      {reserving && state.kind === 'results' && (
        <ReserveDialog
          pharmacyId={reserving.id}
          pharmacyName={reserving.name}
          drugId={state.drugId}
          drugLabel={state.label}
          onClose={() => setReserving(null)}
          onReserved={(r) =>
            setReserved((prev) => ({
              ...prev,
              [reserving.id]: { id: r.id, status: r.status, readyAt: r.readyAt ?? null },
            }))
          }
        />
      )}

      <SiteFooter />
    </div>
  )
}
