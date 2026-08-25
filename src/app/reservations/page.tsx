import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ReservationsList from '@/components/ReservationsList'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Same server-side session gate as prescriptions/page.tsx — this used to
 * be a client component that painted "My reservations" and a loading
 * placeholder before the 401 from /api/reservations sent it to /login.
 * Matches the API route's own role check (PATIENT only).
 */
export default async function ReservationsPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?next=/reservations')
  if (session.role !== 'PATIENT') redirect('/')

  return <ReservationsList />
}
