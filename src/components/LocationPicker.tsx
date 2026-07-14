'use client'

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0z" fill="#dc2626"/>
    <circle cx="16" cy="15" r="6" fill="white"/>
  </svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 40],
})

type Pos = { lat: number; lng: number }

function ClickToMove({ onChange }: { onChange: (p: Pos) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function PanTo({ position }: { position: Pos }) {
  const map = useMap()
  useEffect(() => {
    map.panTo([position.lat, position.lng])
  }, [map, position.lat, position.lng])
  return null
}

type Props = {
  position: Pos
  onChange: (p: Pos) => void
}

/** Draggable/clickable pin so pharmacies confirm their exact location —
 *  geocoding is only a starting point (OSM address coverage in Uyo is patchy). */
export default function LocationPicker({ position, onChange }: Props) {
  return (
    <MapContainer
      center={[position.lat, position.lng]}
      zoom={14}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToMove onChange={onChange} />
      <PanTo position={position} />
      <Marker
        position={[position.lat, position.lng]}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng()
            onChange({ lat: ll.lat, lng: ll.lng })
          },
        }}
      />
    </MapContainer>
  )
}
