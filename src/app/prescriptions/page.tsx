'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PrescriptionDisclaimer from '@/components/PrescriptionDisclaimer'

type UploadRow = {
  id: string
  status: 'PENDING' | 'CLAIMED' | 'ANSWERED' | 'CLOSED'
  patientNote: string | null
  pharmacistName: string | null
  unreadCount: number
  createdAt: string
}

const STATUS_LABEL: Record<UploadRow['status'], [string, string]> = {
  PENDING: ['Waiting for a pharmacist', 'bg-amber-100 text-amber-800'],
  CLAIMED: ['Pharmacist is reviewing', 'bg-blue-100 text-blue-800'],
  ANSWERED: ['Pharmacist replied', 'bg-emerald-100 text-emerald-800'],
  CLOSED: ['Closed', 'bg-gray-100 text-gray-600'],
}

export default function PrescriptionsPage() {
  const router = useRouter()
  const [uploads, setUploads] = useState<UploadRow[] | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/prescriptions')
    if (res.status === 401) {
      router.push('/login?next=/prescriptions')
      return
    }
    if (res.status === 403) {
      router.push('/')
      return
    }
    setUploads((await res.json()).uploads)
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Choose or take a photo of the prescription first')
      return
    }
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      if (note.trim()) form.append('note', note.trim())
      const res = await fetch('/api/prescriptions', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        return
      }
      setNote('')
      if (fileRef.current) fileRef.current.value = ''
      router.push(`/prescriptions/${data.upload.id}`)
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ask a pharmacist</h1>
          <p className="text-sm text-gray-600">
            Upload a prescription you don&apos;t understand — a licensed pharmacist will explain it
          </p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-gray-500 underline">
          Search
        </Link>
      </header>

      <PrescriptionDisclaimer />

      <form onSubmit={submit} className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Photo of the prescription
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:font-semibold file:text-white"
        />
        <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
          What confuses you? <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="e.g. I don't understand how often to take the second drug"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        {error && <p className="mt-1 text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Send to a pharmacist'}
        </button>
      </form>

      <h2 className="mb-2 mt-8 font-semibold text-gray-900">Your questions</h2>
      {!uploads ? (
        <p className="py-8 text-center text-gray-500">Loading…</p>
      ) : uploads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Nothing yet — upload a prescription above to ask your first question.
        </p>
      ) : (
        <ul className="space-y-2">
          {uploads.map((u) => {
            const [label, style] = STATUS_LABEL[u.status]
            return (
              <li key={u.id}>
                <Link
                  href={`/prescriptions/${u.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {u.patientNote ?? 'Prescription question'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                      {u.pharmacistName ? ` · ${u.pharmacistName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {u.unreadCount > 0 && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                        {u.unreadCount} new
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
