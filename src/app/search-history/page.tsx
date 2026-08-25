import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SearchHistoryList from '@/components/SearchHistoryList'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Same server-side session gate as prescriptions/page.tsx. The API route
 * has no role restriction of its own, so any signed-in account may be
 * here — only "signed in at all" is checked.
 */
export default async function SearchHistoryPage() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login?next=/search-history')

  return <SearchHistoryList />
}
