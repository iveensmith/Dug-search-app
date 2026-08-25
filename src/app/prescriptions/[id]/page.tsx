import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PrescriptionThread from '@/components/PrescriptionThread'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

/**
 * Same server-side session gate as prescriptions/page.tsx (the list this
 * thread is opened from) — the API route here has no role restriction of
 * its own beyond being signed in; whether this particular thread belongs
 * to the caller is checked per-request inside PrescriptionThread, same as
 * before.
 */
export default async function PrescriptionThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect(`/login?next=/prescriptions/${id}`)

  return <PrescriptionThread />
}
