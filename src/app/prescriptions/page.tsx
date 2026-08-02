'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PrescriptionDisclaimer from '@/components/PrescriptionDisclaimer'
import DataPrivacyNote from '@/components/DataPrivacyNote'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { IconClipboardList, IconUpload, IconX } from '@/components/ui/icons'

type UploadRow = {
  id: string
  status: 'PENDING' | 'CLAIMED' | 'ANSWERED' | 'CLOSED'
  patientNote: string | null
  pharmacistName: string | null
  unreadCount: number
  createdAt: string
}

const STATUS_LABEL: Record<UploadRow['status'], [string, BadgeTone]> = {
  PENDING: ['Waiting for a pharmacist', 'warning'],
  CLAIMED: ['Pharmacist is reviewing', 'info'],
  ANSWERED: ['Pharmacist replied', 'success'],
  CLOSED: ['Closed', 'neutral'],
}

export default function PrescriptionsPage() {
  const router = useRouter()
  const [uploads, setUploads] = useState<UploadRow[] | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
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

  // Object URLs must be released or the blob stays in memory for the session
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])

  function pickFile(file: File | undefined) {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old.url)
      return file ? { url: URL.createObjectURL(file), name: file.name } : null
    })
    setError('')
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = ''
    pickFile(undefined)
  }

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
      clearFile()
      router.push(`/prescriptions/${data.upload.id}`)
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <header className="py-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Ask a pharmacist</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Upload a prescription you don&apos;t understand — a licensed pharmacist will explain it
        </p>
      </header>

      <PrescriptionDisclaimer />

      <Card className="mt-4">
        <form onSubmit={submit}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Photo of the prescription
          </label>
          <div className="mb-2">
            <DataPrivacyNote />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
            <IconUpload width={18} height={18} className="shrink-0 text-gray-400 dark:text-gray-500" />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => pickFile(e.target.files?.[0])}
              className="w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:font-semibold file:text-white file:hover:bg-emerald-700 dark:text-gray-400 dark:file:bg-emerald-500 dark:file:text-emerald-950"
            />
          </div>

          {preview && (
            <div className="animate-fade-in mt-3 flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              {/* Local blob preview — next/image would need a remote loader
                  and this never leaves the browser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.url}
                alt="Prescription you selected"
                className="h-24 w-24 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ready to send</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{preview.name}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Check it&apos;s sharp and the whole slip is visible.
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove photo"
                className="shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
              >
                <IconX width={16} height={16} />
              </button>
            </div>
          )}
          <div className="mt-4">
            <Field label="What confuses you?" hint="(optional)" htmlFor="note">
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="e.g. I don't understand how often to take the second drug"
                className="text-sm"
              />
            </Field>
          </div>
          {error && <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={busy} className="mt-3 w-full" size="lg">
            {busy ? 'Uploading…' : 'Send to a pharmacist'}
          </Button>
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            A pharmacist usually replies within a few hours. You&apos;ll see their answer on this
            page — we&apos;ll never post it anywhere else.
          </p>
          <div className="mt-4">
            <PrescriptionDisclaimer variant="full" />
          </div>
        </form>
      </Card>

      <h2 className="mb-2 mt-8 font-semibold text-gray-900 dark:text-gray-100">Your questions</h2>
      {!uploads ? (
        <ul className="space-y-2" aria-label="Loading your questions" aria-live="polite">
          {[0, 1].map((i) => (
            <li
              key={i}
              className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="mt-2 h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800/70" />
            </li>
          ))}
        </ul>
      ) : uploads.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <IconClipboardList width={22} height={22} />
          </span>
          <p className="mt-3 font-semibold text-gray-900 dark:text-gray-100">No questions yet</p>
          <p className="mt-1 max-w-sm text-sm text-gray-600 dark:text-gray-400">
            Snap a photo of a prescription you don&apos;t follow — dosage, timing, what a drug is
            for — and a licensed pharmacist will explain it in plain language.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {uploads.map((u) => {
            const [label, tone] = STATUS_LABEL[u.status]
            return (
              <li key={u.id}>
                <Link href={`/prescriptions/${u.id}`}>
                  <Card className="flex items-center justify-between gap-3 transition-shadow hover:shadow-md">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {u.patientNote ?? 'Prescription question'}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                        {u.pharmacistName ? ` · ${u.pharmacistName}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {u.unreadCount > 0 && (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white dark:bg-emerald-500 dark:text-emerald-950">
                          {u.unreadCount} new
                        </span>
                      )}
                      <Badge tone={tone}>{label}</Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      </div>
      <SiteFooter />
    </div>
  )
}
