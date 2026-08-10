'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

/**
 * The pieces every map in this app shares.
 *
 * Client-only and never imported by a server component: the icons are
 * built at module scope, and L.divIcon touches the DOM. Both consumers
 * (ResultsMap, PharmacyMap) are dynamically imported with ssr: false.
 */

/** Inline SVG — avoids Leaflet's default marker image-path issues under bundlers. */
export const pharmacyIcon = L.divIcon({
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

export const userIcon = L.divIcon({
  className: '',
  html: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" fill="#2563eb" fill-opacity="0.25"/>
    <circle cx="10" cy="10" r="5" fill="#2563eb" stroke="white" stroke-width="2"/>
  </svg>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

/**
 * Refits the view when the points change AND when the container is
 * resized or unhidden — Leaflet renders a corner-sized map if it is
 * initialised while display:none, which is what a hidden tab does.
 */
export function FitBounds({ points }: { points: [number, number][] }) {
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
