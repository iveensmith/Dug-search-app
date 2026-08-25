import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PharmacistInbox from '@/components/PharmacistInbox'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Same server-side session gate as prescriptions/page.tsx. Gated to
 * PHARMACIST specifically, tighter than /api/prescriptions' own allowed
 * roles (it also accepts PATIENT, for the separate patient-facing inbox
 * at /prescriptions) — a patient landing here by URL now gets the same
 * "for licensed pharmacists only" outcome the old 403 branch intended,
 * instead of a 200 back with their own empty queue.
 */
export default async function PharmacistPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?next=/pharmacist')
  if (session.role !== 'PHARMACIST') redirect('/')

  return <PharmacistInbox />
}
