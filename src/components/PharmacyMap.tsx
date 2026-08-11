'use client'

import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { FitBounds, pharmacyIcon, userIcon } from '@/components/ui/mapPrimitives'

/**
 * One pharmacy, and the way to it.
 *
 * The detail page had no map at all — its "Directions" button could only
 * hand the patient to Google Maps, which leaves the app, costs a download
 * on a phone that may not have it installed, and loses everything they
 * were reading. The search results have drawn the route in-app since the
 * beginning; this is the same thing on the page a patient lands on when
 * they tap a shop's name.
 *
 * No popups: there is nothing here the page is not already showing in
 * larger type directly above.
 */
export default function PharmacyMap({
  pharmacy,
  userPos,
  routeCoords,
}: {
  pharmacy: { latitude: number; longitude: number; name: string }
  userPos: { lat: number; lng: number } | null
  routeCoords?: [number, number][] | null
}) {
  // With a route drawn, frame the journey; otherwise the shop, and the
  // patient too when we know where they are.
  const points: [number, number][] =
    routeCoords && routeCoords.length > 0
      ? routeCoords
      : userPos
        ? [
            [pharmacy.latitude, pharmacy.longitude],
            [userPos.lat, userPos.lng],
          ]
        : [[pharmacy.latitude, pharmacy.longitude]]

  return (
    <MapContainer
      center={[pharmacy.latitude, pharmacy.longitude]}
      zoom={15}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {routeCoords && routeCoords.length > 0 && (
        <Polyline positions={routeCoords} pathOptions={{ color: '#059669', weight: 5, opacity: 0.8 }} />
      )}
      {/* Leaflet gives every marker role="button" and a tab stop, so each
          one needs a name — an unlabelled button is all a screen reader
          would announce. Neither marker here does anything when pressed
          (this map has no popups), so they are marked non-interactive as
          well: a tab stop that leads nowhere is worse than no tab stop. */}
      {userPos && (
        <Marker
          position={[userPos.lat, userPos.lng]}
          icon={userIcon}
          title="You are here"
          interactive={false}
          keyboard={false}
        />
      )}
      <Marker
        position={[pharmacy.latitude, pharmacy.longitude]}
        icon={pharmacyIcon}
        title={pharmacy.name}
        interactive={false}
        keyboard={false}
      />
    </MapContainer>
  )
}
