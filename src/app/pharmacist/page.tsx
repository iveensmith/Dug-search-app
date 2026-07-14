'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

  const load = useCallback(async () => {
    const res = await fetch('/api/prescriptions')
    if (res.status === 401) {
      router.push('/login?next=/pharmacist')
      return
    }
    if (res.status === 403) {
      setDenied(true)
      return
    }
    setUploads((await res.json()).uploads)
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    const poll = setInterval(load, 15000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
    }
  }, [load])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-gray-700">This page is for licensed pharmacists only.</p>
        <Link href="/" className="mt-4 inline-block text-emerald-700 underline">Back to search</Link>
      </div>
    )
  }
  if (!uploads) return <p className="py-16 text-center text-gray-500">Loading…</p>

  const pending = uploads.filter((u) => u.status === 'PENDING')
  const mine = uploads.filter((u) => u.status !== 'PENDING')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pharmacist desk</h1>
          <p className="text-sm text-gray-600">
            Patients&apos; prescription questions — explain, don&apos;t prescribe
          </p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 underline">Log out</button>
      </header>

      <section>
        <h2 className="mb-2 font-semibold text-gray-900">
          Waiting to be claimed ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
            No open questions right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/prescriptions/${u.id}`}
                  className="block rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {u.patientName}: {u.patientNote ?? 'no note — see photo'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(u.createdAt).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold text-gray-900">Your conversations ({mine.length})</h2>
        {mine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
            Claim a question above to start.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/prescriptions/${u.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {u.patientName}: {u.patientNote ?? 'prescription question'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{u.status.toLowerCase()}</p>
                  </div>
                  {u.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                      {u.unreadCount} new
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
