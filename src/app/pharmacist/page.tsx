'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/ui/AppHeader'
import { logout } from '@/lib/logout'
import SiteFooter from '@/components/ui/SiteFooter'
import LoadMore from '@/components/ui/LoadMore'
import Card from '@/components/ui/Card'

type UploadRow = {
  id: string
  status: 'PENDING' | 'CLAIMED' | 'ANSWERED' | 'CLOSED'
  patientNote: string | null
  patientName: string
  unreadCount: number
  createdAt: string
}

export default function PharmacistPage() {
  const router = useRouter()
  const [uploads, setUploads] = useState<UploadRow[] | null>(null)
  const [denied, setDenied] = useState(false)

  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(
    async (after: string | null = null) => {
      const res = await fetch(`/api/prescriptions${after ? `?cursor=${after}` : ''}`)
      if (res.status === 401) {
        router.push('/login?next=/pharmacist')
        return
      }
      if (res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      setUploads((prev) => (after && prev ? [...prev, ...data.uploads] : data.uploads))
      setCursor(data.nextCursor ?? null)
    },
    [router],
  )

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      await load(cursor)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    // Polling refreshes the first page; it must not append.
    const poll = setInterval(() => load(), 15000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
    }
  }, [load])

  if (denied) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-gray-700 dark:text-gray-300">This page is for licensed pharmacists only.</p>
        <Link href="/" className="mt-4 inline-block text-emerald-700 underline underline-offset-2 dark:text-emerald-400">Back to search</Link>
      </div>
    )
  }
  if (!uploads) return <p className="py-16 text-center text-gray-500 dark:text-gray-400">Loading…</p>

  const pending = uploads.filter((u) => u.status === 'PENDING')
  const mine = uploads.filter((u) => u.status !== 'PENDING')

  return (
    <div className="flex min-h-dvh w-full flex-col">
    <AppHeader
      title="Pharmacist desk"
      subtitle="Patients' prescription questions — explain, don't prescribe"
      onLogout={logout}
      width="max-w-2xl"
    />
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">

      <section>
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
          Waiting to be claimed ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            No open questions right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/prescriptions/${u.id}`}
                  className="block rounded-xl border border-amber-200 bg-amber-50 p-4 transition-shadow hover:shadow-md dark:border-amber-900/60 dark:bg-amber-950/30"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {u.patientName}: {u.patientNote ?? 'no note — see photo'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(u.createdAt).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Your conversations ({mine.length})</h2>
        {mine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Claim a question above to start.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((u) => (
              <li key={u.id}>
                <Link href={`/prescriptions/${u.id}`}>
                  <Card className="flex items-center justify-between gap-3 transition-shadow hover:shadow-md">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {u.patientName}: {u.patientNote ?? 'prescription question'}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{u.status.toLowerCase()}</p>
                    </div>
                    {u.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white dark:bg-emerald-500 dark:text-emerald-950">
                        {u.unreadCount} new
                      </span>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {uploads && uploads.length > 0 && (
        <LoadMore
          shown={uploads.length}
          hasMore={cursor !== null}
          loading={loadingMore}
          onLoadMore={loadMore}
          noun="requests"
        />
      )}
      </div>
      <SiteFooter />
    </div>
  )
}
