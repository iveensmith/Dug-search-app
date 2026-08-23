import type { NextConfig } from "next";

/**
 * Security headers, applied to every response.
 *
 * What the browser is actually allowed to load here is a short list: this
 * origin, plus OpenStreetMap tiles for the three maps. Every fetch the
 * client makes is same-origin — OSRM routing and Resend both happen on the
 * server — so `connect-src 'self'` costs nothing and closes exfiltration
 * to an attacker's host.
 *
 * `'unsafe-inline'` on scripts is the compromise, and worth being straight
 * about: with it, CSP no longer stops an injected inline script. It still
 * stops `<script src="somewhere-else">`, which is the more common way a
 * payload arrives, and it still stops the injected script from *sending*
 * anything anywhere thanks to connect-src.
 *
 * The alternative is per-request nonces, which in Next means generating
 * them in proxy.ts and running it on every HTML route. proxy.ts is
 * currently scoped to "/" on purpose: Next buffers the request body for
 * any route the proxy runs on, capped at 10MB, above which it truncates
 * silently — and prescription uploads are allowed up to 20MB. Widening
 * that matcher to buy a stronger CSP would corrupt large prescription
 * photos instead of rejecting them. Not a trade worth making on this app.
 *
 * The exposure that remains is small: React escapes everything it renders,
 * and the only dangerouslySetInnerHTML in the codebase is the two static
 * scripts in layout.tsx, neither of which touches user input.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Tiles come straight from OSM; data: and blob: are next/image and the
  // local preview of a prescription photo before it is uploaded.
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "script-src 'self' 'unsafe-inline'",
  // Tailwind and Next both inject style attributes at runtime.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  // Two years, subdomains included. Vercel serves HTTPS only, so there is
  // no plaintext origin to lock anyone out of.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Stops a prescription photo being re-interpreted as script because
  // someone got a wrong content type past the upload check.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // frame-ancestors above is the real control; this is for anything that
  // still only understands the old header.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Send the origin cross-site, never the path. A URL here can name a
  // pharmacy, a drug, or a prescription thread id.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Geolocation is asked for by name on the search page. Camera is the
  // prescription photo. Nothing else should ever be requested.
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), camera=(self), microphone=(self), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
};

export default nextConfig;
