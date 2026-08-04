import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import OwnerHome from '@/components/OwnerHome'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * A pharmacy owner's home. This exists as its own route, rendered on the
 * server, because it used to live behind a client-side role check on "/":
 * the patient hero painted first, then swapped to this once /api/auth/me
 * came back, so signing in flashed the wrong page for a second or two.
 *
 * Reading the session here means the right page is the first one drawn.
 * proxy.ts sends owners here from "/" so a bookmark or the logo lands in
 * the same place.
 */
export default async function PharmacyOverviewPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?portal=pharmacy&next=/pharmacy/overview')
  if (session.role !== 'PHARMACY_OWNER') redirect('/')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { displayName: true },
  })

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10">
        <OwnerHome displayName={user?.displayName ?? null} />
      </div>
      <SiteFooter />
    </div>
  )
}
