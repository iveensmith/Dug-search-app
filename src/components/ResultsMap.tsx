'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { FitBounds, pharmacyIcon, userIcon } from '@/components/ui/mapPrimitives'
import { type PharmacyResult, type ActiveRoute, directionsUrl } from '@/lib/types'
import { IconPhone } from '@/components/ui/icons'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import OpenStatusBadge from '@/components/ui/OpenStatusBadge'

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
      <FitBounds points={points} />
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
