import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Sends a signed-in pharmacy owner from "/" to their own overview before
 * anything renders.
 *
 * "/" is the patient search page and decides what to show from a
 * client-side /api/auth/me call, so an owner landing there saw the patient
 * hero first and the owner page a beat later. Deciding here, in front of
 * the render, means they only ever see one page.
 *
 * Everyone else — patients, pharmacists, admins, signed-out visitors —
 * falls through untouched.
 *
 * (Next 16 renamed the `middleware` convention to `proxy`; it defaults to
 * the Node.js runtime now. See node_modules/next/dist/docs — 01-app/
 * 03-api-reference/03-file-conventions/proxy.md.)
 */
export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (session?.role === 'PHARMACY_OWNER') {
    return NextResponse.redirect(new URL('/pharmacy/overview', request.url))
  }
  return NextResponse.next()
}

// Only the home page. Without a matcher this would run on every request,
// including static assets.
export const config = {
  matcher: '/',
}
