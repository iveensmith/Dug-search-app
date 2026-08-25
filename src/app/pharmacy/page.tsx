import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PharmacyDashboardPage from '@/components/PharmacyDashboardPage'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Same server-side session gate as prescriptions/page.tsx. Matches
 * /api/inventory's own role check (PHARMACY_OWNER only) — anyone else
 * lands on /, the same outcome the old client-side check turned into
 * "This account is not a pharmacy owner account."
 */
export default async function PharmacyPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?next=/pharmacy')
  if (session.role !== 'PHARMACY_OWNER') redirect('/')

  return <PharmacyDashboardPage />
}
