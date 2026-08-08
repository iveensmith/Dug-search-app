'use client'

import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import { useCallback, useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

type Pos = { lat: number; lng: number }

/** Whether a reported position came from the owner moving the map. */
export type MoveSource = 'user' | 'program'

/**
 * The pin is drawn over the middle of the map and never moves. What moves
 * is the map underneath it.
 *
 * The previous version put a draggable Leaflet marker at the position,
 * which starts dead centre — exactly where a hand goes to drag a map.
 * Grabbing there picked up the pin instead of the map, so the map sat
 * still while the pin slid away, and the whole thing read as "it only
 * zooms, it won't pan". Measured on a desktop mouse: a drag from the
 * centre moved the pin and left the map; a drag from anywhere else
 * panned normally.
 *
 * pointer-events-none is the part that matters. This element sits on top
 * of the entire map, so without it the dead zone would be worse, not
 * better — every drag would land on the crosshair.
 */
function CentrePin() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center">
      {/* -mt-5 lifts the teardrop so its tip, not its middle, marks the spot. */}
      <svg width="32" height="42" viewBox="0 0 32 42" className="-mt-5 drop-shadow-md" aria-hidden="true">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0z" fill="#dc2626" />
        <circle cx="16" cy="15" r="6" fill="white" />
      </svg>
    </div>
  )
}

function MapWiring({
  position,
  onChange,
}: {
  position: Pos
  onChange: (p: Pos, source: MoveSource) => void
}) {
  const map = useMap()

  // Marks a position change as one the map itself produced, so the effect
  // below does not then try to recentre on it. Recentring mid-pan fights
  // the drag and snaps the view back.
  const fromMap = useRef(false)

  // moveend fires for map.setView too, so "the map moved" is not the same
  // as "somebody moved the map". Without this, picking a state would
  // recentre the map, report a position, and tick the "pin is on my
  // pharmacy" box on the owner's behalf — leaving them able to submit a
  // pin sitting on the geographic centre of their state.
  const userDriven = useRef(false)

  const reportCentre = useCallback(() => {
    const c = map.getCenter()
    const source: MoveSource = userDriven.current ? 'user' : 'program'
    userDriven.current = false
    fromMap.current = true
    onChange({ lat: c.lat, lng: c.lng }, source)
  }, [map, onChange])

  useMapEvents({
    // Wherever the map settles, that is the chosen spot.
    moveend: reportCentre,
    dragstart: () => {
      userDriven.current = true
    },
    // A tap is a shortcut for "put that point in the middle" — it ends in
    // moveend, which reports it.
    click: (e) => {
      userDriven.current = true
      map.setView(e.latlng, map.getZoom())
    },
  })

  // Only positions set from outside the map — the state picker, the place
  // search, pasted coordinates — move the view.
  useEffect(() => {
    if (fromMap.current) {
      fromMap.current = false
      return
    }
    map.setView([position.lat, position.lng], map.getZoom())
  }, [map, position.lat, position.lng])

  return null
}

type Props = {
  position: Pos
  /** `source` is 'user' only when the owner dragged or tapped the map. */
  onChange: (p: Pos, source: MoveSource) => void
}

/**
 * Pin-your-location map: pan the map so the crosshair sits on the
 * shopfront. Geocoding is only ever a starting point — OSM address
 * coverage across Nigeria is patchy, which is why this is confirmed by
 * hand rather than trusted.
 */
export default function LocationPicker({ position, onChange }: Props) {
  return (
    <div className="relative h-full w-full">
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
      <CentrePin />
    </div>
  )
}
