import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import OwnerRatings from '@/components/OwnerRatings'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Every rating a pharmacy has, in one place.
 *
 * The overview shows the score and the last few comments; this is where
 * an owner reads the whole history and answers anything they missed.
 *
 * Guarded on the server for the same reason as the overview — a
 * client-side role check paints the page first and takes it away after.
 */
// Owner-only, so it is marked away from crawlers as well as retitled.
export const metadata: Metadata = {
  title: 'Your ratings',
  description: 'Every rating patients have left for your pharmacy, and your replies.',
  robots: { index: false, follow: false },
}

export default async function PharmacyRatingsPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?portal=pharmacy&next=/pharmacy/ratings')
  if (session.role !== 'PHARMACY_OWNER') redirect('/')

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10">
        <OwnerRatings />
      </div>
      <SiteFooter />
    </div>
  )
}
