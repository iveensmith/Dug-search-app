import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Same server-side session gate as prescriptions/page.tsx. Matches the
 * admin API routes' own role check (ADMIN only) — anyone else lands on /,
 * matching the 403 the old client-side check turned into a "for
 * administrators only" notice.
 */
export default async function AdminPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?next=/admin')
  if (session.role !== 'ADMIN') redirect('/')

  return <AdminDashboard />
}
