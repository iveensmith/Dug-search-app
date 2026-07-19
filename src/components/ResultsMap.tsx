'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { type PharmacyResult, type ActiveRoute, directionsUrl } from '@/lib/types'
import { IconPhone } from '@/components/ui/icons'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import OpenStatusBadge from '@/components/ui/OpenStatusBadge'

// Inline SVG pins — avoids Leaflet's default marker image-path issues under bundlers
const pharmacyIcon = L.divIcon({
  className: '',
  html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0z" fill="#059669"/>
    <rect x="13.5" y="8" width="5" height="16" rx="1.5" fill="white"/>
    <rect x="8" y="13.5" width="16" height="5" rx="1.5" fill="white"/>
  </svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
})

const userIcon = L.divIcon({
  className: '',
  html: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" fill="#2563eb" fill-opacity="0.25"/>
    <circle cx="10" cy="10" r="5" fill="#2563eb" stroke="white" stroke-width="2"/>
  </svg>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// Refits bounds when results change AND when the container is resized/unhidden
// (Leaflet renders a corner-sized map if initialized while display:none).
function MapController({ points }: { points: [number, number][] }) {
  const map = useMap()
  const pointsKey = JSON.stringify(points)
  useEffect(() => {
    let frame = 0
    const fit = () => {
      const { clientWidth, clientHeight } = map.getContainer()
      if (clientWidth === 0 || clientHeight === 0) return // hidden — wait for resize
      map.invalidateSize()
      // fitBounds must see the post-invalidate size; defer one frame
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (points.length > 0) {
          map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
        }
      })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(map.getContainer())
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointsKey])
  return null
}

type Props = {
  results: PharmacyResult[]
  userPos: { lat: number; lng: number } | null
  center: { lat: number; lng: number }
  route?: ActiveRoute | null
  onRoute?: (r: PharmacyResult) => void
}

export default function ResultsMap({ results, userPos, center, route, onRoute }: Props) {
  // With an active route, fit the view to the route; otherwise to all pins
  let points: [number, number][]
  if (route) {
    points = route.coords
  } else {
    points = results.map((r) => [r.latitude, r.longitude])
    if (userPos) points.push([userPos.lat, userPos.lng])
  }

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController points={points} />
      {route && (
        <Polyline
          positions={route.coords}
          pathOptions={{ color: '#059669', weight: 5, opacity: 0.8 }}
        />
      )}
      {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} />}
      {results.map((r) => (
        <Marker key={r.id} position={[r.latitude, r.longitude]} icon={pharmacyIcon}>
          <Popup>
            <div className="min-w-[180px]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                <div className="flex items-center gap-1.5">
                  <OpenStatusBadge open24h={r.open24h} opensAt={r.opensAt} closesAt={r.closesAt} />
                  <VerifiedBadge />
                </div>
              </div>
              <p className="text-sm">{r.address}</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm">
                {r.distanceKm.toFixed(1)} km away
                <span className="inline-flex items-center gap-1">
                  · <IconPhone width={12} height={12} className="inline" /> {r.phone}
                </span>
              </p>
              <div className="mt-1.5 flex gap-3 text-sm">
                {onRoute && (
                  <button
                    onClick={() => onRoute(r)}
                    className="cursor-pointer font-medium text-emerald-700 underline underline-offset-2"
                  >
                    Route
                  </button>
                )}
                <a
                  href={directionsUrl(r.latitude, r.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-700"
                >
                  Google Maps
                </a>
                <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="font-medium text-emerald-700">
                  Call
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
