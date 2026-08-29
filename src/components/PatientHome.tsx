'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { pickLga } from '@/lib/detectLga'
import SavedDrugs from '@/components/SavedDrugs'
import SiteHeader, { HOME_RESET_EVENT } from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import NetworkStatsRow from '@/components/NetworkStatsRow'
import { HOW_IT_WORKS_ART } from '@/components/ui/HowItWorksArt'
import ResultAnatomy from '@/components/ui/ResultAnatomy'
import LiveActivityFeed from '@/components/LiveActivityFeed'
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
    <div className="flex h-full items-center justify-center text-sm text-faint">
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


// v2: the default state changed to Lagos, so old remembered values are
// ignored once — a returning visitor gets the new default and re-picks
// persist as normal.
const STATE_STORAGE_KEY = 'mediquest_state_v2'

// Where a visitor starts before they pick or share their location — the
// biggest market, so the most people land somewhere useful. Detection
// still switches it when they tap "Use my location".
const DEFAULT_STATE: NigerianStateValue = 'LAGOS'

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
    // Through our own server, not straight to Nominatim: this is a GPS fix
    // accurate to a few metres, and sending it from the browser hands a
    // third party both the coordinates and the patient's IP address.
    const res = await fetch(`/api/geocode?lat=${pos.lat}&lon=${pos.lng}`)
    if (!res.ok) return null
    const data = await res.json()
    const stateName: string | undefined = data?.address?.state
    const state = stateName ? matchStateName(stateName) : null
    if (!state) return null

    // Matching lives in lib/detectLga, where it can be tested against real
    // response shapes — the alternative is standing in 774 places.
    const { lgasForState } = await loadLgas()
    const lga = pickLga(data?.address, data?.displayName, lgasForState(state))
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
    <p className="text-sm font-bold text-ink">{children}</p>
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
  const [selectedState, setSelectedState] = useState<NigerianStateValue | null>(DEFAULT_STATE)
  const [selectedLga, setSelectedLga] = useState('')
  const lgaOptions = useLgas(selectedState)
  const [pickerOpen, setPickerOpen] = useState(false) // full state/LGA dropdowns vs the compact chip
  const selectedLgaRef = useRef('') // read inside runSearch (avoids stale closure)
  // The state is known from the start now (the default, or a remembered
  // pick) — so this is only ever true while the "Use my location" button
  // is working, never blocking the picker on load.
  const [detectingState, setDetectingState] = useState(false)
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
  // Null until the first load answers; empty array means "asked, none".
  const [savedDrugs, setSavedDrugs] = useState<DrugSuggestion[]>([])
  // Started as a list before anything has been searched — see the panel.
  const [listMode, setListMode] = useState(false)
  // Where "Find these medicines" takes you.
  const coverageRef = useRef<HTMLDivElement | null>(null)
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

  const loadSaved = useCallback(() => {
    fetch('/api/saved-drugs')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setSavedDrugs(json?.drugs ?? []))
      .catch(() => setSavedDrugs([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(loadSaved, 0)
    return () => clearTimeout(timer)
  }, [loadSaved])

  const isSaved = (drugId: string) => savedDrugs.some((d) => d.id === drugId)

  /**
   * Optimistic, and deliberately so: this is a bookmark, not a booking.
   * Waiting on a round trip to fill in a star makes the tap feel broken
   * on a slow connection, and the worst case is a chip that reappears on
   * the next load.
   */
  async function toggleSaved(drug: DrugSuggestion) {
    const saving = !isSaved(drug.id)
    setSavedDrugs((prev) => (saving ? [drug, ...prev] : prev.filter((d) => d.id !== drug.id)))
    try {
      if (saving) {
        await fetch('/api/saved-drugs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drugId: drug.id }),
        })
      } else {
        await fetch(`/api/saved-drugs/${drug.id}`, { method: 'DELETE' })
      }
    } catch {
      // Put it back the way the server still has it.
      loadSaved()
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
          // The state on load is the default (or a remembered/account
          // pick) — a quiet background detection no longer switches it
          // out from under the visitor. Switching state is an explicit
          // tap on "Use my location" (detectMyArea). What detection still
          // does silently is fill the LGA, but only when the area it
          // found is inside the state that's already selected.
          const forState =
            stored && isValidState(stored) ? stored : accountState ?? DEFAULT_STATE
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
    // listMode covers the first pick, when the basket is still empty
    // because the patient chose "several medicines" before searching.
    if (basket.length > 0 || listMode) {
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
    setListMode(true)
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
      setListMode(false)
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

  /** Takes anything with a position and a name — see MappableResult. */
  async function showRoute(r: Omit<PharmacyResult, 'stockLevel'>) {
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
  const panelOpen = panelExpanded || needsArea || pickerOpen || basket.length > 0 || listMode

  const compactPanel = (
    <button
      type="button"
      onClick={() => setPanelExpanded(true)}
      className="mb-4 flex w-full cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left shadow-card transition-colors hover:border-line-brand"
    >
      <span className="flex shrink-0 items-center justify-center rounded-control bg-brand-soft p-2 text-brand-ink">
        <IconSearch width={16} height={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">
          {askedFor || 'New search'}
        </span>
        {selectedLabel && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <IconMapPin width={12} height={12} className="shrink-0" />
            <span className="truncate">
              {selectedLga ? `${selectedLabel} · ${selectedLga}` : selectedLabel}
            </span>
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm font-semibold text-brand-ink">
        Change
      </span>
    </button>
  )

  // The one interactive thing that matters — rendered inside the hero while
  // idle, and above the results once a search has run.
  const searchPanel = (
    <Card
      id="search"
      radius="lg"
      className="surface-lit relative mb-4 scroll-mt-24 overflow-hidden border-line/70 shadow-lift"
      padded={false}
    >
      {/* A green hairline along the top edge — the search box is the one
          thing on the page we want touched, and this marks it as the
          brand's own surface without a heavy fill. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-brand/70" />
      <div className="space-y-4 p-5 sm:p-7">
        {/* The panel is two questions and one answer, in that order. It
            used to be a row of controls, which said nothing about what
            the app is for — the whole product is "which shop near me has
            this", and the shape of the box should be that sentence. */}
        <StepLabel>Where are you?</StepLabel>

        {areaChosen && !pickerOpen ? (
          <div className="flex items-center justify-between gap-2 rounded-control bg-brand-soft px-3.5 py-2.5">
            <p className="flex min-w-0 items-center gap-2 text-sm text-muted">
              <IconMapPin width={16} height={16} className="shrink-0 text-brand-ink" />
              {/* Broad to narrow, matching the order the pickers ask in. */}
              <span className="truncate">
                <span className="font-semibold text-ink">{selectedLabel}</span>
                <span className="mx-1.5 text-faint">·</span>
                <span className="font-semibold text-ink">{selectedLga}</span>
              </span>
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="shrink-0 cursor-pointer text-sm font-semibold text-brand-ink underline underline-offset-2"
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
              <p className="flex items-start gap-2 rounded-control bg-warn-soft p-3 text-sm font-medium text-warn-ink">
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
                        : 'Select your area'}
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
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-terracotta-300 px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-soft disabled:opacity-50 dark:border-terracotta-800"
            >
              <IconMapPin width={15} height={15} />
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
            {locationHint && (
              <p className="text-xs text-warn-ink">{locationHint}</p>
            )}
            {!needsArea && (
              <p className="text-xs text-muted">
                Or skip this — search a medicine and we&apos;ll ask afterwards.
              </p>
            )}
          </>
        )}

        {/* The list, when there is one. Above the box because it is what
            the next pick joins — and every chip removable, since a
            prescription typed wrong is the normal way this goes astray. */}
        {basket.length > 0 && (
          <div className="rounded-control border border-line-brand bg-brand-soft p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-ink">
              Medicines you need ({basket.length})
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {basket.map((d) => (
                <li key={d.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface py-1 pl-3 pr-1 text-xs font-semibold text-ink shadow-card">
                    {drugLabel(d)}
                    <button
                      type="button"
                      onClick={() => removeFromList(d.id)}
                      aria-label={`Remove ${drugLabel(d)} from the list`}
                      className="cursor-pointer rounded-full p-1 text-faint transition-colors hover:bg-sunken hover:text-ink"
                    >
                      <IconX width={12} height={12} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-terracotta-800/80 dark:text-terracotta-300/80">
              {basket.length >= MAX_DRUGS
                ? `That's the most we can search at once.`
                : 'Add the rest below — we\'ll show which pharmacies have the most of them.'}
            </p>
          </div>
        )}

        <div className="border-t border-line-soft pt-4">
          <StepLabel>
            {basket.length > 0 || listMode
              ? 'Add another medicine'
              : 'What medicine do you need?'}
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
            // With a list built the box is empty, so there is nothing to
            // submit and the button did nothing. Here it means "show me
            // what you found" — the results are already below, they were
            // just off the bottom of the screen.
            onEmptyAction={
              basket.length > 0
                ? () => {
                    setPanelExpanded(false)
                    coverageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                : undefined
            }
            // The quick picks belong between the box and the button: they
            // are examples of what to type, so they are useless below the
            // thing that ends the task.
            footer={
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => quickSearch(term)}
                      className="cursor-pointer rounded-full border border-line bg-canvas px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-line-brand hover:bg-brand-soft hover:text-brand-ink"
                    >
                      {term}
                    </button>
                  ))}
                </div>

                <SavedDrugs
                  drugs={savedDrugs}
                  onPick={(drug) => void searchDrug(drug)}
                  onRemove={(drug) => void toggleSaved(drug)}
                  disabled={basket.length >= MAX_DRUGS}
                />

                {/* Searching for several at once has worked all along, but
                    the only way in was a button that appeared after a
                    search — so somebody holding a prescription with four
                    lines on it had to search one of them to find out. */}
                {!listMode && basket.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setListMode(true)
                      setTimeout(() => searchInputRef.current?.focus(), 0)
                    }}
                    className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-ink"
                  >
                    <IconPlus width={13} height={13} />
                    Need several medicines? Search them together
                  </button>
                )}
              </>
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

      {/* The landmark starts here, not at the results below. The hero, the
          search box and the marketing sections are the page for a visitor
          who has not searched yet — with <main> further down they were
          content belonging to no landmark, and there was nothing for a
          screen reader to skip the header to. */}
      <main className="flex w-full flex-1 flex-col pb-10">
      {state.kind === 'idle' && (
        <>
          {/* The page is now a stack of full-width bands that alternate
              between a mint field and the page background, each holding
              its own centred container — which is why <main> no longer
              carries the max width. A band cannot be edge-to-edge from
              inside a 64rem column, and the alternation is most of what
              makes the layout read as designed rather than assembled. */}
          {/*
            The hero: the message on the left, the search panel on the
            right. There is no image — the search box is the hero's own
            subject, so it shares the first screen with the headline rather
            than sitting below it. On a phone the grid collapses and the two
            stack in source order (message, then panel), which is the
            arrangement the hero has always had.
          */}
          <section className="border-b border-line bg-canvas">
          {/* Asymmetric padding: a tight top so the headline sits near the
              header rather than floating in the lower half, a generous
              bottom so the band still breathes into the page. */}
          <div className="mx-auto w-full max-w-6xl px-4 pt-9 pb-16 sm:pt-11 sm:pb-20 lg:pt-14 lg:pb-24 xl:pt-16 xl:pb-28">
          {/* One column until `lg` — the message, then the panel, stacked,
              exactly as before. From `lg` they sit side by side, message
              left and panel right, with the message given the wider track;
              the panel is centred against the taller text column so neither
              side trails empty space. */}
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.9fr)] lg:gap-14 xl:gap-16">
            <div className="intro">
              <p className="flex items-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-ink">
                <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
                Nigeria&apos;s pharmacy stock network
              </p>
              {/* "in stock" carries the colour because it is the part that
                  says what this is for — every pharmacy has medicine, the
                  question is which one has it today. From `lg` the line
                  breaks are set by hand so the coloured phrase always sits
                  on its own line; below that it wraps naturally with just
                  the phrase kept whole. */}
              <h1 className="mt-6 text-balance font-display text-[2.85rem] font-semibold leading-[0.98] tracking-[-0.04em] text-ink sm:text-[3.6rem] lg:[text-wrap:initial] lg:text-[3.95rem] lg:leading-[1] xl:text-[4.5rem]">
                Find the medicine
                <br className="hidden lg:block" />{' '}
                <span className="whitespace-nowrap text-brand-ink">that&apos;s in stock</span>
                <br className="hidden lg:block" />{' '}
                near you.
              </h1>
              <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-muted lg:text-[1.125rem]">
                Stop calling pharmacy after pharmacy. Search a drug, see who has it in stock nearby,
                and get directions or call — free, across Nigeria.
              </p>

              {/* Legitimacy in the first screen, not below the fold. The
                  full four-promise card still sits further down with room
                  to explain itself; this is the compressed version, for
                  someone deciding in three seconds whether a health site
                  they have never heard of is worth typing a drug name
                  into. */}
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-line-brand pt-5">
                {TRUST_BADGES.slice(0, 3).map(({ label, Icon }) => (
                  <li
                    key={label}
                    className="flex items-start gap-1.5 text-xs font-semibold text-muted"
                  >
                    <Icon
                      width={14}
                      height={14}
                      className="mt-px shrink-0 text-brand-ink"
                    />
                    {label}
                  </li>
                ))}
              </ul>

              {/* Counted, not claimed — see NetworkStatsRow. It disappears
                  rather than shrink a number. */}
              <NetworkStatsRow />
            </div>

            {/* Just the search panel. The live "a pharmacy confirmed stock
                just now" proof used to sit under it as a second card, but a
                quiet network made it stale — "confirmed 10 hours ago" over
                a dot that isn't pulsing reads worse than nothing. The
                dedicated "Live on the network" section downpage carries
                that proof, and only when it is genuinely live. */}
            <div style={{ animation: 'intro-rise 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both' }}>
              {searchPanel}
            </div>
          </div>
          </div>
          </section>

          <section className="reveal">
            <div className="mx-auto w-full max-w-5xl px-4 pt-12 md:pt-16">
              {/* The other way in, for someone holding a slip they cannot
                  read. It sits under the search box because searching is
                  still the main act — but it was a thin one-line row, easy
                  to scroll past, and this is the path for the patients least
                  able to help themselves. Brand green, like everything
                  else — it is a different kind of help, not a different
                  product. */}
              {/* A clean surface card with one green edge — a left rule
                  that marks it as the same kind of "we'll get you there"
                  device the result cards use, not a separate product. */}
              <Link
                href="/prescriptions"
                className="group relative mt-4 block overflow-hidden rounded-card border border-line border-l-2 border-l-brand bg-surface p-4 shadow-card transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-line-brand hover:border-l-brand hover:shadow-lift sm:mt-5 sm:p-7"
              >
                <div className="relative flex items-center gap-3.5 sm:items-start sm:gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-ink transition-colors duration-200 group-hover:bg-brand group-hover:text-on-brand sm:h-14 sm:w-14">
                    <IconCamera width={22} height={22} className="sm:hidden" />
                    <IconClipboardList width={24} height={24} className="hidden sm:block" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-semibold tracking-[-0.02em] text-ink sm:text-xl">
                      Not sure what you need?
                    </span>
                    {/* Two wordings, one meaning. The phone gets the short
                        one because the card is competing with the search
                        box on a 390px screen, and losing that contest is
                        the point — searching is still the main act. */}
                    <span className="mt-0.5 block text-sm leading-snug text-muted sm:hidden">
                      Tap to send a photo of your prescription — a Pharmacist will explain.
                    </span>
                    <span className="mt-1 hidden text-base leading-relaxed text-muted sm:block">
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
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted"
                          >
                            <IconCheck
                              width={13}
                              height={13}
                              className="shrink-0 text-brand-ink"
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
                    <span className="mt-4 hidden items-center gap-1.5 text-sm font-semibold text-brand-ink sm:inline-flex">
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
                    className="shrink-0 text-brand-ink transition-transform duration-200 group-hover:translate-x-0.5 sm:hidden"
                  />
                </div>
              </Link>

              {/* A quiet card, deliberately. It sits under a terracotta
                  gradient call to action, and a second loud panel would
                  compete with the thing we actually want tapped — this is
                  reassurance you read on the way past. */}
              <div className="mt-6 rounded-sheet border border-line/90 bg-surface/70 p-5 backdrop-blur-sm">
                {/* Four across once there is room. It was one column for
                    as long as this card lived in a 464px-wide grid column,
                    where two wrapped every label onto a second line —
                    "PCN-verified / pharmacies". The card spans the full
                    measure now, so the row fits and the stack of four
                    would just be a tall list of short lines. */}
                <ul className="reveal-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {TRUST_BADGES.map(({ label, Icon }) => (
                    <li key={label} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-brand-soft text-brand-ink">
                        <Icon width={16} height={16} />
                      </span>
                      <span className="min-w-0 text-sm font-semibold leading-snug text-ink">
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="reveal">
            <div className="mx-auto w-full max-w-5xl px-4 py-16 md:py-24">
            <p className="flex items-center justify-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-ink">
              <span className="h-px w-6 shrink-0 bg-brand/50" />
              How it works
            </p>
            <h2 className="mx-auto mt-4 max-w-lg text-balance text-center font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-4xl">
              Three steps between you and{' '}
              <span className="text-brand-ink">your medicine</span>
            </h2>
            {/* Numbered rather than iconed-and-numbered: the step number is
                the thing that says "there are only three of these", which
                is the whole reassurance this section exists to give. The
                icon stays, smaller, as a label for the step. */}
            {/* One column until there is real room — the cards carry a
                screenshot each and need their full width to be legible, so
                they only go three-across from `lg`. */}
            <ol className="reveal-stagger mx-auto mt-12 grid max-w-md gap-5 lg:max-w-none lg:grid-cols-3 lg:gap-6">
              {HOW_IT_WORKS.map(({ title, text }, i) => {
                const Art = HOW_IT_WORKS_ART[i]
                return (
                <li
                  key={title}
                  className="overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-line-brand hover:shadow-lift"
                >
                  <Art />
                  <div className="p-2 pt-4">
                    <div className="flex items-baseline gap-2.5">
                      {/* The step number is the reassurance this section
                          exists to give — "there are only three". */}
                      <span className="font-display text-[1.5rem] font-semibold leading-none tabular-nums tracking-[-0.04em] text-brand">
                        {i + 1}
                      </span>
                      <p className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">{title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                  </div>
                </li>
                )
              })}
            </ol>
            </div>
          </section>

          <ResultAnatomy />

          <LiveActivityFeed />

          {/* Native <details> so the accordion works before hydration and
              stays keyboard- and screen-reader-correct for free. */}
          <section className="reveal border-b border-line bg-canvas">
            <div className="mx-auto w-full max-w-5xl px-4 py-16 md:py-24">
            <p className="flex items-center justify-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-ink">
              <span className="h-px w-6 shrink-0 bg-brand/50" />
              Questions
            </p>
            <h2 className="mx-auto mt-4 max-w-lg text-balance text-center font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-4xl">
              {/* Not "…before they trust us": naming the doubt invites it,
                  and a page about finding medicine should not open its FAQ
                  by conceding that trust is the question. This says the
                  same thing from the other end — these are the answers
                  people actually want — without the flinch. */}
              What patients <span className="text-brand-ink">ask us most</span>
            </h2>
            <div className="reveal-stagger mx-auto mt-12 max-w-2xl space-y-3">
              {FAQ.map(({ q, a }, i) => (
                <details
                  key={q}
                  // First one open so the section shows an answer, not four
                  // shut bars — the one people most want is "how current".
                  open={i === 0}
                  className="group rounded-card border border-line bg-surface shadow-card transition-colors open:border-line-brand"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    {q}
                    <IconChevronDown
                      width={20}
                      height={20}
                      className="shrink-0 text-faint transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
            </div>
          </section>

          {/* The supply side. A stock network is only as good as the shops
              in it, so the page makes the ask out loud rather than leaving
              it to a footer link. Hidden only from accounts that already
              have a pharmacy — everyone else gets a real path (a patient
              who taps through lands on "create a pharmacy owner account",
              not a dead end). */}
          {viewerLoaded && viewerRole !== 'PHARMACY_OWNER' && (
            <section className="reveal">
              <div className="mx-auto w-full max-w-5xl px-4 py-16 md:py-24">
              <div className="grain relative overflow-hidden rounded-sheet bg-brand-deep p-8 shadow-lift sm:p-12">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full border border-white/10"
                />
                <p className="relative flex items-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/60">
                  <span className="h-px w-6 bg-white/40" aria-hidden="true" />
                  For pharmacies
                </p>
                <h2 className="relative mt-4 max-w-lg font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-on-brand-deep sm:text-3xl">
                  Run a pharmacy? Put your shelf on the map.
                </h2>
                <p className="relative mt-3.5 max-w-xl leading-relaxed text-white/80">
                  Patients are already searching your area for what you stock. List free, keep your
                  shelf current in a tap, and be the result they call.
                </p>

                {/* Three lines of substance so the panel is an offer, not
                    just a button. */}
                <ul className="relative mt-7 grid gap-3 sm:grid-cols-3 sm:gap-5">
                  {[
                    ['Free to list', 'No fee, no commission on what a patient buys.'],
                    ['One tap to confirm', 'Mark an item in or out of stock from your phone.'],
                    ['PCN-verified', 'We check your licence before you appear in a search.'],
                  ].map(([label, detail]) => (
                    <li key={label} className="flex gap-2.5">
                      <IconCheck
                        width={16}
                        height={16}
                        className="mt-0.5 shrink-0 text-white/70"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-on-brand-deep">{label}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-white/65">{detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Colours are written out rather than taken from
                    buttonClass(): the variants there assume a light page
                    background, and on this deep-green panel their text
                    colours collide with the overrides. */}
                <div className="relative mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/pharmacy/register"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-control bg-white px-6 py-3.5 text-base font-semibold tracking-[-0.01em] text-brand-800 transition-[background-color,transform] duration-150 hover:bg-brand-50 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep"
                  >
                    <IconStore width={18} height={18} />
                    Register your pharmacy
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border border-white/30 px-6 py-3.5 text-base font-semibold tracking-[-0.01em] text-on-brand-deep transition-[background-color,border-color,transform] duration-150 hover:border-white/60 hover:bg-white/10 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep"
                  >
                    Already listed? Sign in
                    <IconChevronRight width={18} height={18} />
                  </Link>
                </div>
              </div>
              </div>
            </section>
          )}

          {/* Closing band — the page ends by handing the visitor back the
              one thing it is for. The chips run a real search; the link
              opens the full box at the top. */}
          <section className="reveal surface-lit border-y border-line bg-surface">
            <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center md:py-28">
              <h2 className="text-balance font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[2.6rem]">
                Know what you need?{' '}
                <span className="text-brand-ink">Search it now.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-muted">
                A brand name or a generic — we match both, and show which pharmacy near you has it
                on the shelf.
              </p>
              <div className="reveal-stagger mt-8 flex flex-wrap items-center justify-center gap-2.5">
                {QUICK_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => quickSearch(term)}
                    className="cursor-pointer rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-card transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-ink"
                  >
                    {term}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPanelExpanded(true)
                  document
                    .getElementById('search')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  setTimeout(() => searchInputRef.current?.focus(), 400)
                }}
                className="mt-7 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
              >
                Search for something else
                <IconChevronRight width={15} height={15} />
              </button>
            </div>
          </section>
        </>
      )}

      {/* Everything past the idle marketing bands is one column again —
          results, the panel above them and the location line all belong
          inside the same measure the bands centre their own content on. */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-6">
      {/*
        The page's heading once the hero is gone.

        Searching replaces the whole idle fragment, and the <h1> lived in
        it — so from the moment anybody used this page it had no level-one
        heading at all, which is the landmark a screen reader user lands on
        to find out what they are looking at. It is visually hidden because
        the compact panel above already shows the medicine and the area in
        the design's own terms; this is the same fact, said once, in the
        structure.
      */}
      {state.kind !== 'idle' && (
        <h1 className="sr-only">
          {state.kind === 'no-match'
            ? `No medicine matching ${state.query}`
            : [askedFor, selectedLga || selectedLabel].filter(Boolean).join(' in ')}
        </h1>
      )}
      {state.kind !== 'idle' && (panelOpen ? searchPanel : compactPanel)}

      {state.kind !== 'idle' &&
        (selectedState && userPos ? (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-brand-ink">
            <IconMapPin width={14} height={14} />
            Using your location — distances and directions start from where you are
          </p>
        ) : selectedState && locationDenied ? (
          <div className="text-center text-xs text-faint">
            <p>
              Location is off — measuring from {stateLabel(selectedState)}&apos;s capital.{' '}
              <button
                onClick={enableLocation}
                disabled={locating}
                className="cursor-pointer font-medium text-brand-ink underline underline-offset-2 disabled:opacity-50"
              >
                {locating ? 'Getting your location…' : 'Use my location'}
              </button>
            </p>
            {locationHint && <p className="mt-1 text-warn-ink">{locationHint}</p>}
          </div>
        ) : null)}

      <div className="mt-8 flex-1">
        {/* The idle state used to end with a "tips" card here — location
            status and a "try Paracetamol or Panadol" hint. Both are
            already in the search panel at the top of the page (the chips,
            the "Use my location" button), and stranded at the foot of a
            long marketing page after the restructure it only added
            clutter. Removed. */}

        {state.kind === 'loading' && (
          <ul className="space-y-3" aria-label="Searching pharmacies" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded-card border border-line bg-surface p-4">
                <div className="h-4 w-2/5 rounded bg-line" />
                <div className="mt-2 h-3 w-3/5 rounded bg-sunken" />
                <div className="mt-4 h-9 rounded-lg bg-sunken" />
              </li>
            ))}
          </ul>
        )}

        {state.kind === 'coverage' && (
          <div ref={coverageRef} className="scroll-mt-20">
            {state.drugs.length < 2 ? (
              <Card className="text-center">
                <p className="font-semibold text-ink">
                  Add a second medicine
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
                  Search for the next thing on your prescription and we&apos;ll show which
                  pharmacies near you have the most of the list.
                </p>
              </Card>
            ) : coverageLoading ? (
              <ul className="space-y-3" aria-label="Searching pharmacies" aria-live="polite">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="animate-pulse rounded-card border border-line bg-surface p-4"
                  >
                    <div className="h-4 w-2/5 rounded bg-line" />
                    <div className="mt-2 h-3 w-3/5 rounded bg-sunken" />
                    <div className="mt-4 h-9 rounded-lg bg-sunken" />
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">
                  {state.results.length === 0 ? (
                    <>Nothing in {selectedLabel} lists any of these.</>
                  ) : (
                    <>
                      <span className="font-semibold text-ink">
                        {state.results.length}
                      </span>{' '}
                      {state.results.length === 1 ? 'pharmacy' : 'pharmacies'} in {selectedLabel}{' '}
                      {state.results.length === 1 ? 'has' : 'have'} at least one of your{' '}
                      {state.drugs.length} medicines
                    </>
                  )}
                </p>
                {/* A route needs somewhere to be drawn. Without a map
                    here, Directions had nowhere in-app to go and left for
                    Google Maps — the single-medicine results have had
                    this all along. */}
                {route && state.results.length > 0 && (
                  <div className="mb-4 overflow-hidden rounded-card border border-line">
                    {/* The map fills its container, so the container is what
                        gives it a height — without one it collapses to
                        nothing and the route is drawn into a zero-pixel
                        box. map-tiles is what keeps the tiles legible in
                        dark mode. */}
                    <div className="map-tiles h-[55dvh]">
                      <ResultsMap
                        results={state.results}
                        userPos={userPos}
                        center={mapCenter}
                        route={route}
                        onRoute={showRoute}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3.5 py-2.5">
                      <p className="text-sm text-muted">
                        <span className="font-semibold text-ink">
                          {route.pharmacyName}
                        </span>{' '}
                        — {route.distanceKm.toFixed(1)} km, about {Math.round(route.durationMin)} min
                      </p>
                      <div className="flex items-center gap-3">
                        {/* Kept, and labelled for what it is: turn-by-turn
                            voice guidance is not something this map does. */}
                        <a
                          href={directionsUrl(route.toLat, route.toLng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-brand-ink underline underline-offset-2"
                        >
                          Voice navigation
                        </a>
                        <button
                          type="button"
                          onClick={() => setRoute(null)}
                          className="cursor-pointer text-sm font-semibold text-muted underline underline-offset-2"
                        >
                          Close map
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {routeError && (
                  <p className="mb-3 text-sm text-warn-ink">{routeError}</p>
                )}

                <CoverageResults
                  drugs={state.drugs}
                  results={state.results}
                  onCall={handleCall}
                  copiedPhone={copiedPhone ?? ''}
                  onDirections={showRoute}
                  routeBusyId={routeBusyId}
                />
              </>
            )}
          </div>
        )}

        {state.kind === 'no-match' && (
          <div className="animate-fade-up mt-10 flex flex-col items-center rounded-card border border-warn bg-warn-soft p-6 text-center">
            <IconAlertCircle className="text-amber-500 dark:text-amber-400" />
            <p className="mt-2 font-medium text-warn-ink">
              No drug matching “{state.query}” is in our list yet.
            </p>
            <p className="mt-1 text-sm text-warn-ink">
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
          <div className="animate-fade-up mb-4 rounded-card border border-line border-l-4 border-l-amber-400 bg-surface p-4 dark:border-l-amber-500">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <IconAlertCircle width={16} height={16} className="shrink-0 text-amber-500 dark:text-amber-400" />
              {dispensingClass('POM')!.label}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {dispensingClass('POM')!.note}
            </p>
            <Link
              href="/prescriptions"
              className="mt-2.5 inline-block text-sm font-bold text-brand-ink underline underline-offset-2"
            >
              Don&apos;t have one? Ask a pharmacist →
            </Link>
          </div>
        )}

        {state.kind === 'results' && results.length === 0 && (
          <>
            <div className="animate-fade-up rounded-card border border-warn bg-warn-soft p-6">
              <div className="flex items-start gap-3">
                <IconAlertCircle width={22} height={22} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
                <div className="min-w-0">
                  <p className="font-semibold text-warn-ink">
                    No pharmacy in {selectedLga} has {state.label} right now
                  </p>
                  <p className="mt-1 text-sm text-warn-ink">
                    Here&apos;s what you can do instead — stock changes daily, so it&apos;s worth
                    checking back.
                  </p>
                </div>
              </div>
            </div>

            {state.elsewhere.length > 0 && (
              <div className="mt-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <IconMapPin width={15} height={15} className="text-brand-ink" />
                  Available elsewhere in {selectedLabel}
                </h2>
                <ul className="space-y-2">
                  {state.elsewhere.map((r) => (
                    <li key={r.id}>
                      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{r.name}</p>
                          <p className="text-xs text-faint">
                            {r.lga ? `${r.lga} · ` : ''}
                            {r.distanceKm.toFixed(1)} km away
                          </p>
                          <p className="text-xs text-faint">
                            Stock updated {relativeTime(r.stockUpdatedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={`tel:${r.phone.replace(/\s/g, '')}`}
                            onClick={(e) => handleCall(e, r.phone)}
                            className="flex-1 rounded-lg border border-terracotta-600/60 px-3 py-2 text-center text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-soft sm:flex-none dark:border-terracotta-400/50"
                          >
                            {copiedPhone === r.phone ? 'Copied ✓' : 'Call'}
                          </a>
                          <button
                            onClick={() => showRoute(r)}
                            disabled={routeBusyId === r.id}
                            className="flex-1 cursor-pointer rounded-lg bg-brand px-3 py-2 text-center text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60 sm:flex-none"
                          >
                            {routeBusyId === r.id ? 'Loading…' : 'Directions'}
                          </button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-faint">
                  Call ahead before travelling — these are outside {selectedLga}.
                </p>
              </div>
            )}

            {routeError && (
              <p className="mt-4 rounded-control border border-warn bg-warn-soft p-3 text-sm text-warn-ink">
                {routeError}
              </p>
            )}

            {route && (
              <div ref={emptyRouteRef} className="mt-4 scroll-mt-24">
                <div className="mb-3 flex items-center justify-between gap-3 rounded-control border border-line-brand bg-brand-soft p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-terracotta-900 dark:text-terracotta-300">
                      {route.pharmacyName}
                    </p>
                    <p className="text-xs text-brand-ink">
                      {route.distanceKm.toFixed(1)} km · ~{route.durationMin} min drive
                      {!userPos ? ` from ${selectedLabel}'s capital` : ' from your location'}
                    </p>
                    <a
                      href={directionsUrl(route.toLat, route.toLng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-brand-ink underline underline-offset-2"
                    >
                      Voice navigation (opens Google Maps)
                    </a>
                  </div>
                  <button
                    onClick={() => setRoute(null)}
                    aria-label="Clear route"
                    className="shrink-0 cursor-pointer rounded-full p-1.5 text-brand-ink hover:bg-terracotta-100 dark:hover:bg-terracotta-900/40"
                  >
                    <IconX width={16} height={16} />
                  </button>
                </div>
                <div className="map-tiles h-[55dvh] overflow-hidden rounded-card border border-line">
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
                <h2 className="mb-2 text-sm font-semibold text-ink">
                  Try this instead — same generic, different strength/form
                </h2>
                <ul className="space-y-2">
                  {state.substitutes.map((sub) => (
                    <li key={sub.drug.id}>
                      <Card className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {drugLabel(sub.drug)}
                          </p>
                          <p className="text-xs text-faint">
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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-ink">
                  <IconMessageCircle width={19} height={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Not sure what to do next?
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Speak to a licensed pharmacist for drug advice.
                  </p>
                  <Link
                    href="/prescriptions"
                    className="mt-2 inline-block text-sm font-semibold text-brand-ink underline underline-offset-2"
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
            {/* Stacked on a phone, side by side from `sm`.
                Side by side, this sentence is min-w-0 next to shrink-0
                controls, so it gets whatever is left — 149px at 390 and
                119px at 360. A medicine name is one long unbreakable
                token ("Amoxicillin/Clavulanate"), so instead of wrapping
                it overflowed its own box by 21px and 51px and ran under
                the Filters button. The boxes never intersected, which is
                why this looked fine to a hit-test and wrong to a person.
                break-words is the second half: stacked it has room, but
                a longer name on a narrower phone would spill again. */}
            <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="min-w-0 break-words text-sm text-muted">
                <span className="font-semibold text-ink">{results.length}</span>{' '}
                {activeFilterCount(filters) > 0 ? ` of ${allResults.length} ` : ' '}
                {results.length === 1 ? 'pharmacy has' : 'pharmacies have'}{' '}
                <Link
                  href={`/drugs/${state.drugId}?state=${selectedState}&lga=${encodeURIComponent(selectedLga)}`}
                  className="font-medium text-brand-ink underline underline-offset-2"
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
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:border-line-brand hover:text-brand-ink"
                >
                  Filters
                  {activeFilterCount(filters) > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold text-on-brand">
                      {activeFilterCount(filters)}
                    </span>
                  )}
                </button>
                <div className="flex overflow-hidden rounded-lg border border-line-strong text-sm md:hidden">
                  <button
                    onClick={() => setView('list')}
                    className={`cursor-pointer px-4 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-brand text-on-brand' : 'bg-surface text-muted'}`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setView('map')}
                    className={`cursor-pointer px-4 py-1.5 font-medium transition-colors ${view === 'map' ? 'bg-brand text-on-brand' : 'bg-surface text-muted'}`}
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
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => startList(state.drug)}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-terracotta-300 px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:border-terracotta-500 hover:bg-brand-soft dark:border-terracotta-800 dark:hover:border-terracotta-600"
                >
                  <IconPlus width={15} height={15} />
                  Need more than one? Add to a list
                </button>

                {/* Only for a signed-in patient: there is nowhere to keep
                    a saved medicine for anyone else, and a control that
                    silently does nothing is worse than no control. */}
                {viewerRole === 'PATIENT' && (
                  <button
                    type="button"
                    onClick={() => void toggleSaved((state as { drug: DrugSuggestion }).drug)}
                    aria-pressed={isSaved(state.drug.id)}
                    // Leads with the word on the button, then names the
                    // medicine: a screen reader hears which "Save" this
                    // is, and the visible label is still contained in the
                    // accessible one (WCAG 2.5.3).
                    aria-label={
                      isSaved(state.drug.id)
                        ? `Saved ${state.label}, tap to remove`
                        : `Save ${state.label}`
                    }
                    className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-control border px-4 py-2.5 text-sm font-semibold transition-colors ${
                      isSaved(state.drug.id)
                        ? 'border-brand bg-brand text-on-brand'
                        : 'border-line-strong text-ink hover:border-brand hover:bg-brand-soft'
                    }`}
                  >
                    <IconBookmark width={15} height={15} />
                    {isSaved(state.drug.id) ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
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
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-line bg-surface text-muted hover:border-line-brand hover:bg-brand-soft hover:text-brand-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {routeError && (
              <p className="mb-3 rounded-control border border-warn bg-warn-soft p-3 text-sm text-warn-ink">
                {routeError}
              </p>
            )}

            {route && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-control border border-line-brand bg-brand-soft p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-terracotta-900 dark:text-terracotta-300">
                    {route.pharmacyName}
                  </p>
                  <p className="text-xs text-brand-ink">
                    {route.distanceKm.toFixed(1)} km · ~{route.durationMin} min drive
                    {!userPos ? ` from ${selectedLabel}'s capital` : ' from your location'}
                  </p>
                  <a
                    href={directionsUrl(route.toLat, route.toLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-brand-ink underline underline-offset-2"
                  >
                    Voice navigation (opens Google Maps)
                  </a>
                </div>
                <button
                  onClick={() => setRoute(null)}
                  aria-label="Clear route"
                  className="shrink-0 cursor-pointer rounded-full p-2 text-brand-ink hover:bg-terracotta-100 dark:hover:bg-terracotta-900/50"
                >
                  <IconX width={14} height={14} />
                </button>
              </div>
            )}

            {results.length === 0 ? (
              <div className="rounded-card border border-dashed border-line-strong p-8 text-center">
                <p className="font-semibold text-ink">
                  No pharmacy matches those filters
                </p>
                <p className="mt-1 text-sm text-muted">
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
                    className="overflow-hidden rounded-card border border-line border-l-2 border-l-brand bg-surface p-5 shadow-card transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-line-brand hover:border-l-brand hover:shadow-lift"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-field bg-brand-soft text-brand-ink">
                        <IconStore width={22} height={22} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/pharmacies/${r.id}`}
                            className="truncate font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink transition-colors hover:text-brand-ink"
                          >
                            {r.name}
                          </Link>
                          <span className="shrink-0 font-mono text-[0.8125rem] font-medium tabular-nums text-faint">
                            {r.distanceKm.toFixed(1)} km
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-faint">
                          {r.address}
                          {r.lga ? ` · ${r.lga}` : ''}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
                      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-brand-ink">Rate</span>
                    </button>

                    {stockFreshness(r.stockUpdatedAt).tone === 'stale' && (
                      <p className="mt-3 text-xs text-warn-ink">
                        Not confirmed in over a day — worth calling first.
                      </p>
                    )}

                    {/* Wraps, and every button sizes from content.
                        A flex item's min-width is auto, so the old flex-1
                        on Directions could not shrink below its 141px
                        content width: Call + Details + Directions came to
                        ~353px against ~248px of card at 320, and the green
                        button hung off the right edge. flex-auto lets the
                        row break onto a second line exactly when the three
                        stop fitting, and share the width evenly when they
                        do fit. */}
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <a
                        href={`tel:${r.phone.replace(/\s/g, '')}`}
                        onClick={(e) => handleCall(e, r.phone)}
                        aria-label={`Call ${r.name}`}
                        className="flex flex-auto items-center justify-center gap-2 rounded-control border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft"
                      >
                        <IconPhone width={16} height={16} />
                        {copiedPhone === r.phone ? 'Copied ✓' : 'Call'}
                      </a>
                      <Link
                        href={`/pharmacies/${r.id}`}
                        className="flex flex-auto items-center justify-center rounded-control border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft"
                      >
                        Details
                      </Link>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => showRoute(r)}
                        loading={routeBusyId === r.id}
                        className="flex-auto"
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
                      <div className="mt-2.5 rounded-control bg-brand-soft p-3">
                        {/* The tick belongs here, on the state, and nowhere
                            near the button. A filled green block wearing a
                            tick and the words "Medicine obtained" reads as
                            a badge saying it already happened — three
                            signals all pointing at "done" on a control
                            whose entire job is to say "not yet". */}
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
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
                          className="mt-2 w-full bg-surface/70 dark:bg-transparent"
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
                <li className="flex items-start gap-3 rounded-card bg-info-soft p-4">
                  <IconAlertCircle
                    width={18}
                    height={18}
                    className="mt-0.5 shrink-0 text-info-ink"
                  />
                  <p className="text-sm text-info-ink">
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
      </div>
      </div>
      </main>

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
