'use client'

import { use, useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import OpenStatusBadge from '@/components/ui/OpenStatusBadge'
import RatingStars from '@/components/RatingStars'
import { directionsUrl } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import { MIN_RATINGS_TO_SCORE, RATING_DIMENSIONS, type RatingSummary } from '@/lib/ratings'
import { IconPhone, IconRoute, IconShieldCheck } from '@/components/ui/icons'

// Opens only when someone taps "Rate this pharmacy".
const RatePharmacyDialog = dynamic(() => import('@/components/RatePharmacyDialog'), { ssr: false })

// Leaflet touches `window` — client-only, and not worth downloading until
// this page is actually open.
const PharmacyMap = dynamic(() => import('@/components/PharmacyMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-emerald-50 dark:bg-emerald-950/40" />,
})

type Pharmacy = {
  id: string
  name: string
  address: string
  state: string
  lga: string | null
  phone: string
  latitude: number
  longitude: number
  open24h: boolean
  opensAt: string | null
  closesAt: string | null
}

type Comment = {
  id: string
  comment: string
  createdAt: string
  author: string
  ownerReply: string | null
}

type Payload = {
  pharmacy: Pharmacy
  ratings: RatingSummary
  comments: Comment[]
}

export default function PharmacyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Payload | null>(null)
  const [missing, setMissing] = useState(false)
  const [rating, setRating] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/pharmacies/${id}`)
    if (!res.ok) {
      setMissing(true)
      return
    }
    setData(await res.json())
  }, [id])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      {/* Full width so the band behind the map card can run edge to edge.
          Every branch below puts the reading measure back. */}
      <main className="w-full flex-1 pb-16">
        {missing ? (
          <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Pharmacy not found</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              It may not be verified yet, or the link is out of date.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
            >
              Back to search
            </Link>
          </div>
        ) : !data ? (
          <div className="space-y-4 py-8">
            <div className="h-44 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : (
          <PharmacyBody data={data} onRate={() => setRating(true)} />
        )}
      </main>

      {rating && data && (
        <RatePharmacyDialog
          pharmacyId={data.pharmacy.id}
          pharmacyName={data.pharmacy.name}
          onClose={() => setRating(false)}
          onSaved={() => load()}
        />
      )}

      <SiteFooter />
    </div>
  )
}

function PharmacyBody({ data, onRate }: { data: Payload; onRate: () => void }) {
  // Defaulted, not assumed: this is a public page reached from every search
  // result, and a field missing from the response should cost a section,
  // not blank the page with an error screen.
  const { pharmacy: p, ratings, comments = [] } = data
  const [copied, setCopied] = useState(false)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [route, setRoute] = useState<{
    coords: [number, number][]
    distanceKm: number
    durationMin: number
  } | null>(null)
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState('')

  /**
   * Draws the way there on the map above, rather than handing the patient
   * to Google Maps and losing the page they were reading. Google Maps is
   * still offered underneath for turn-by-turn voice, which this cannot do
   * — same split as the search results.
   */
  async function showRoute() {
    setRouteError('')
    setRouting(true)
    try {
      const pos =
        userPos ??
        (await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          if (!navigator.geolocation) return resolve(null)
          navigator.geolocation.getCurrentPosition(
            (g) => resolve({ lat: g.coords.latitude, lng: g.coords.longitude }),
            () => resolve(null),
            { timeout: 10000 },
          )
        }))
      if (!pos) {
        setRouteError('Turn on location to draw the route, or open Google Maps below.')
        return
      }
      setUserPos(pos)
      const params = new URLSearchParams({
        fromLat: String(pos.lat),
        fromLng: String(pos.lng),
        toLat: String(p.latitude),
        toLng: String(p.longitude),
      })
      const res = await fetch(`/api/route?${params}`)
      if (!res.ok) {
        setRouteError('Could not work out the route — use Google Maps below.')
        return
      }
      const data = await res.json()
      setRoute({ coords: data.coords, distanceKm: data.distanceKm, durationMin: data.durationMin })
    } catch {
      setRouteError('Could not work out the route — use Google Maps below.')
    } finally {
      setRouting(false)
    }
  }

  function call(e: React.MouseEvent) {
    // Desktop has no dialler — copy instead of dead-ending the tap
    if (!/Mobi|Android/i.test(navigator.userAgent)) {
      e.preventDefault()
      navigator.clipboard?.writeText(p.phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="animate-fade-up">
      {/*
        The map card sits on a mint field rather than opening straight onto
        the page colour. This page's heading is the shop's name under its
        own map, which is a stronger opening than a title band would be —
        putting one above it would print the name twice — so the band goes
        behind the card instead and the page still starts the way the rest
        of the site does.
      */}
      <div className="bg-emerald-50 py-8 dark:bg-emerald-950/25">
      <div className="mx-auto w-full max-w-2xl px-4">
      <Card padded={false} radius="lg" className="overflow-hidden">
        {/* Was a gradient with a pin drawn on it — decoration standing
            where the actual map belongs. */}
        <div className="relative h-56 sm:h-64">
          <PharmacyMap
            pharmacy={{ latitude: p.latitude, longitude: p.longitude, name: p.name }}
            userPos={userPos}
            routeCoords={route?.coords ?? null}
          />
          {/* Right-hand side: Leaflet puts its zoom controls top-left,
              and the badge was sitting under them. */}
          <span className="pointer-events-none absolute right-4 top-4 z-[500] inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-md">
            <IconShieldCheck width={13} height={13} />
            PCN verified
          </span>
        </div>
        <div className="p-5">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">{p.name}</h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{p.address}</p>
          <p className="mt-0.5 text-sm tabular-nums text-gray-500 dark:text-gray-400">
            {p.phone}
            {p.lga ? ` · ${p.lga}` : ''} · {stateLabel(p.state)}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <OpenStatusBadge open24h={p.open24h} opensAt={p.opensAt} closesAt={p.closesAt} />
            <Badge tone="neutral">Hours self-reported</Badge>
          </div>

          <div className="mt-5 flex gap-2.5">
            <button
              onClick={showRoute}
              disabled={routing}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950"
            >
              <IconRoute width={16} height={16} />
              {routing ? 'Finding the way…' : route ? 'Route shown above' : 'Directions'}
            </button>
            <a
              href={`tel:${p.phone.replace(/\s/g, '')}`}
              onClick={call}
              aria-label={`Call ${p.name}`}
              className="flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
            >
              <IconPhone width={16} height={16} />
              {copied ? 'Copied ✓' : 'Call'}
            </a>
          </div>

          {route && (
            <p className="mt-2.5 text-sm text-emerald-800 dark:text-emerald-300">
              <span className="font-semibold">
                {route.distanceKm.toFixed(1)} km · about {route.durationMin} min
              </span>{' '}
              driving from where you are
            </p>
          )}
          {routeError && (
            <p className="mt-2.5 text-sm text-amber-700 dark:text-amber-400">{routeError}</p>
          )}

          {/* Underneath, not instead of. An in-app line on a map cannot
              speak turn-by-turn directions while somebody is driving, and
              that is the one thing Google Maps is genuinely better at. */}
          <a
            href={directionsUrl(p.latitude, p.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-block text-sm font-medium text-gray-500 underline underline-offset-2 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-emerald-400"
          >
            Voice navigation (opens Google Maps)
          </a>
        </div>
      </Card>
      </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
      <Card radius="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            What patients say
          </p>
          <RatingStars value={ratings.scored ? ratings.overall : null} count={ratings.count} size={16} />
        </div>

        {ratings.count === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            No ratings yet — be the first to say how this pharmacy did.
          </p>
        ) : !ratings.scored ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {ratings.count} {ratings.count === 1 ? 'patient has' : 'patients have'} rated this
            pharmacy. We publish a score once there are {MIN_RATINGS_TO_SCORE}, so one visit
            doesn&apos;t define a shop.
          </p>
        ) : (
          <dl className="mt-4 space-y-3">
            {RATING_DIMENSIONS.map(({ key, label }) => {
              const value = ratings.averages![key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <dt className="w-36 shrink-0 text-sm leading-tight text-gray-600 dark:text-gray-400">{label}</dt>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                  <dd className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                    {value.toFixed(1)}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}

        {comments.length > 0 && (
          <ul className="mt-5 space-y-4 border-t border-gray-100 pt-4 dark:border-gray-800">
            {comments.map((c) => (
              <li key={c.id}>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{c.author}</span>{' '}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  &ldquo;{c.comment}&rdquo;
                </p>
                {c.ownerReply && (
                  <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm text-gray-700 dark:bg-emerald-500/10 dark:text-gray-300">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {p.name} replied:
                    </span>{' '}
                    {c.ownerReply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <Button variant="secondary" size="sm" shape="pill" className="mt-4 w-full" onClick={onRate}>
          Rate this pharmacy
        </Button>
      </Card>

      <Card radius="lg" className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Opening hours
        </p>
        <div className="mt-2 flex items-center justify-between py-1">
          <span className="text-sm text-gray-600 dark:text-gray-400">Every day</span>
          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {p.open24h ? 'Open 24 hours' : p.opensAt && p.closesAt ? `${p.opensAt} – ${p.closesAt}` : 'Not stated'}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Self-reported by the pharmacy, in Nigerian time.
        </p>
      </Card>

      </div>
    </div>
  )
}
