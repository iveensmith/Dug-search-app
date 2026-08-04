import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PatientHome from '@/components/PatientHome'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * The home page decides who it is for on the server.
 *
 * It used to be a client component that fetched /api/auth/me and swapped
 * itself for the owner overview once the answer arrived, so an owner saw
 * the patient hero first. Worse, "/" was statically prerendered: a
 * <Link href="/"> click — the logo — was served straight from the client
 * router cache, so proxy.ts never ran and an owner simply stayed on the
 * patient search page.
 *
 * Reading the session here fixes both. It costs "/" its static
 * generation, which is a real trade: the page is now rendered per request
 * rather than served from the CDN. The shell it returns is small and
 * everything on it was already client-fetched, and the alternative is an
 * owner landing on a page built for patients.
 */
export default async function HomePage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (session?.role === 'PHARMACY_OWNER') redirect('/pharmacy/overview')

  return <PatientHome />
}
