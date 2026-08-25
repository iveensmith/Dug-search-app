import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PrescriptionsInbox from '@/components/PrescriptionsInbox'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Reads the session on the server before anything renders. This used to be
 * a client component that painted the whole "Ask a pharmacist" page first
 * and only found out from `/api/prescriptions` returning 401 afterwards —
 * so a signed-out visitor saw the form for a moment before being bounced
 * to /login, the same flash pharmacy/overview/page.tsx already fixed once.
 *
 * Same roles as the API route's own check (PATIENT, PHARMACIST) — a
 * pharmacy owner or admin lands on / instead, matching its 403.
 */
export default async function PrescriptionsPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?next=/prescriptions')
  if (session.role !== 'PATIENT' && session.role !== 'PHARMACIST') redirect('/')

  return <PrescriptionsInbox />
}
