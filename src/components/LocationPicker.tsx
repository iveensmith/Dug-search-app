'use client'

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * A button floating over the map. Leaflet treats a click anywhere in the
 * map container as a map click, which here would move the pin — so the
 * container has to swallow its own events before they reach the map.
 */
function MapButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current)
  }, [])
  return (
    <div ref={ref} className="absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2">
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer rounded-full bg-white/95 px-3.5 py-2 text-xs font-semibold text-gray-800 shadow-md ring-1 ring-black/10 backdrop-blur-sm hover:bg-white"
      >
        {children}
      </button>
    </div>
  )
}

function MapWiring({ position, onChange }: { position: Pos; onChange: (p: Pos) => void }) {
  const map = useMap()
  const [pinInView, setPinInView] = useState(true)

  // Marks a position change as one the user made on the map — by dragging
  // the pin or clicking. Those must NOT recentre the view: recentring after
  // a pin drag slides the map the opposite way and snaps the pin back to
  // the middle, which is indistinguishable from the map refusing to pan.
  // And since the pin used to be pinned to the centre, the middle of the
  // map — where you naturally grab to pan — was always on top of it.
  const fromMap = useRef(false)
  const report = useCallback(
    (p: Pos) => {
      fromMap.current = true
      onChange(p)
    },
    [onChange],
  )

  const checkPinInView = useCallback(() => {
    setPinInView(map.getBounds().contains([position.lat, position.lng]))
  }, [map, position.lat, position.lng])

  useMapEvents({
    click: (e) => report({ lat: e.latlng.lat, lng: e.latlng.lng }),
    moveend: checkPinInView,
    zoomend: checkPinInView,
  })

  // Only positions set from outside the map — the state picker, the address
  // search — move the view.
  useEffect(() => {
    if (fromMap.current) {
      fromMap.current = false
      return
    }
    map.setView([position.lat, position.lng], map.getZoom())
    setPinInView(true)
  }, [map, position.lat, position.lng])

  return (
    <>
      <Marker
        position={[position.lat, position.lng]}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng()
            report({ lat: ll.lat, lng: ll.lng })
          },
        }}
      />
      {!pinInView && (
        <MapButton
          onClick={() => {
            map.setView([position.lat, position.lng], map.getZoom())
            setPinInView(true)
          }}
        >
          Back to my pin
        </MapButton>
      )}
    </>
  )
}

type Props = {
  position: Pos
  onChange: (p: Pos) => void
}

/** Draggable/clickable pin so pharmacies confirm their exact location —
 *  geocoding is only a starting point (OSM address coverage across Nigeria is patchy). */
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
      <MapWiring position={position} onChange={onChange} />
    </MapContainer>
  )
}
