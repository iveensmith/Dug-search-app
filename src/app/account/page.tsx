import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AccountSettings from '@/components/AccountSettings'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Session read on the server, same as prescriptions/page.tsx — this used
 * to be a client component that painted "My account" and a loading
 * placeholder before finding out from /api/auth/me that nobody was signed
 * in and bouncing to /login. Any signed-in role may be here; there is no
 * role restriction on the account page itself.
 */
export default async function AccountPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?next=/account')

  return <AccountSettings />
}
