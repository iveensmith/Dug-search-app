'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PrescriptionDisclaimer from '@/components/PrescriptionDisclaimer'
import DataPrivacyNote from '@/components/DataPrivacyNote'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import LoadMore from '@/components/ui/LoadMore'
import Card from '@/components/ui/Card'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { downscaleImage } from '@/lib/downscaleImage'
import { MAX_REQUEST_BYTES, readErrorMessage } from '@/lib/uploadLimits'
import { IconCamera, IconClipboardList, IconMic, IconUpload, IconX } from '@/components/ui/icons'
import AudioNoteRecorder, { type RecordedNote } from '@/components/AudioNoteRecorder'
import { formatDuration } from '@/lib/audioNotes'

type UploadRow = {
  id: string
  status: 'PENDING' | 'CLAIMED' | 'ANSWERED' | 'CLOSED'
  patientNote: string | null
  hasAudio: boolean
  audioDurationSec: number | null
  pharmacistName: string | null
  unreadCount: number
  createdAt: string
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
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
  // The photo as picked. Held here rather than read back off the input at
  // submit, because there are two inputs now and only one of them holds
  // it — reading the wrong one refuses a photo the patient can see.
  const [chosen, setChosen] = useState<File | null>(null)
  // The photo actually sent: the shrunk one when that worked, otherwise
  // whatever was picked.
  const [ready, setReady] = useState<File | null>(null)
  const [shrinking, setShrinking] = useState(false)
  // A spoken note, for patients who would rather say it than type it.
  const [voiceNote, setVoiceNote] = useState<RecordedNote | null>(null)
  const [savedBytes, setSavedBytes] = useState<{ from: number; to: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Kept apart from fileRef so the camera path and the picker path can
  // both exist; one input cannot be both at once.
  const cameraRef = useRef<HTMLInputElement>(null)

  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(
    async (after: string | null = null) => {
      const res = await fetch(`/api/prescriptions${after ? `?cursor=${after}` : ''}`)
      if (res.status === 401) {
        router.push('/login?next=/prescriptions')
        return
      }
      if (res.status === 403) {
        router.push('/')
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
    return () => clearTimeout(timer)
  }, [load])

  // Object URLs must be released or the blob stays in memory for the session
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])

  /**
   * Shrinks the photo as soon as it is chosen, rather than at submit, so
   * the work overlaps with the patient writing their note and the send
   * itself is quick. The result is held here; the file input still holds
   * the original, which is the fallback if this produced nothing.
   */
  async function pickFile(file: File | undefined) {
    setError('')
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old.url)
      return file ? { url: URL.createObjectURL(file), name: file.name } : null
    })
    setReady(null)
    setChosen(file ?? null)
    if (!file) return

    setShrinking(true)
    try {
      const smaller = await downscaleImage(file)
      setReady(smaller)
      if (smaller !== file) {
        setSavedBytes({ from: file.size, to: smaller.size })
      } else {
        setSavedBytes(null)
      }
    } finally {
      setShrinking(false)
    }
  }

  // Both inputs, always: picking from one after the other leaves a stale
  // file on the first, and an input that still holds a file will not fire
  // change when the same file is picked again.
  function clearFile() {
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
    pickFile(undefined)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const original = chosen
    if (!original) {
      setError('Choose or take a photo of the prescription first')
      return
    }
    // Falls back to the original if the browser couldn't shrink it, or if
    // submit somehow beat the shrink.
    const file = ready ?? original
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      if (note.trim()) form.append('note', note.trim())
      if (voiceNote) {
        // The extension matters: some servers and players sniff it, and the
        // blob has no name of its own.
        form.append('audio', voiceNote.blob, 'voice-note')
        form.append('audioDuration', String(voiceNote.seconds))
      }
      // Refused before it leaves, with a reason. The platform rejects an
      // oversized body with an error page rather than JSON, so sending it
      // anyway produced "network problem" on a perfectly good connection.
      const total = file.size + (voiceNote?.blob.size ?? 0)
      if (total > MAX_REQUEST_BYTES) {
        setError(
          `That photo is too large to send (${formatSize(total)}). Take it again from a little further back, or pick a smaller one.`,
        )
        return
      }

      const res = await fetch('/api/prescriptions', { method: 'POST', body: form })
      // Status first, body second: reading JSON from a non-JSON error
      // response throws, and that throw used to be reported as the
      // patient's network failing.
      if (!res.ok) {
        setError(await readErrorMessage(res, 'Upload failed — please try again'))
        return
      }
      const data = await res.json()
      setNote('')
      setVoiceNote(null)
      clearFile()
      // The question was sent, but without the recording. Said on the
      // thread they are about to land on, because the alternative is a
      // patient assuming a pharmacist heard something they never got.
      router.push(
        `/prescriptions/${data.upload.id}${data.audioFailed ? '?voiceNoteFailed=1' : ''}`,
      )
    } catch {
      // Only a genuine fetch failure reaches here now.
      setError('Could not reach MediQuest — check your connection and try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <header className="py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Ask a pharmacist</h1>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
          Upload a prescription you don&apos;t understand — a licensed pharmacist will explain it
        </p>
      </header>

      <PrescriptionDisclaimer />

      <Card className="mt-5">
        <form onSubmit={submit}>
          {/* A heading rather than a <label>: a label points at one control
              and there are two here. The buttons below carry their own
              names, so nothing is announced unnamed. */}
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Photo of the prescription
          </p>
          <div className="mb-2">
            <DataPrivacyNote />
          </div>
          {/* Two ways in, because there were not two before. `capture` sends
              a phone straight to the camera and never offers the gallery
              or Files — so a prescription already photographed, or sent
              over WhatsApp, or scanned on a laptop, had no way in at all.
              Splitting it keeps the one-tap camera path for the common
              case and stops it being the only case.

              The camera button is hidden where there is unlikely to be a
              camera to open: on a desktop it would open the same file
              dialog as the other button, under a name that promises
              something else. */}
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-300 p-3 sm:flex-row dark:border-gray-700">
            <input
              ref={cameraRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => pickFile(e.target.files?.[0])}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => pickFile(e.target.files?.[0])}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="hidden flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 [@media(pointer:coarse)]:inline-flex dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
            >
              <IconCamera width={16} height={16} />
              Take a photo
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
            >
              <IconUpload width={16} height={16} />
              Choose a saved photo
            </button>
          </div>

          {preview && (
            <div className="animate-fade-in mt-3 flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              {/* Local blob preview — next/image would need a remote loader
                  and this never leaves the browser. Not lazy either: it
                  appears the moment the user picks a file, and the bytes
                  are already here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.url}
                alt="Prescription you selected"
                decoding="async"
                className="h-24 w-24 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ready to send</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{preview.name}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Check it&apos;s sharp and the whole slip is visible.
                </p>
                {shrinking ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Preparing the photo…
                  </p>
                ) : (
                  savedBytes && (
                    // Worth saying out loud on a metered connection: it
                    // explains why sending is quick and that the data cost
                    // is a fraction of the photo.
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                      Shrunk to {formatSize(savedBytes.to)} (from{' '}
                      {formatSize(savedBytes.from)}) so it sends fast on mobile data.
                    </p>
                  )
                )}
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
          <div className="mt-5">
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

          {/* Beside the typed note rather than instead of it. Some people
              type, some speak, and plenty do both — a sentence of text and
              thirty seconds explaining what it actually feels like. */}
          <div className="mt-4">
            <AudioNoteRecorder value={voiceNote} onChange={setVoiceNote} disabled={busy} />
          </div>
          {error && <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          {/* Blocked while the photo is being prepared — submitting then
              would send the full-size original and undo the point. */}
          <Button
            type="submit"
            loading={busy || shrinking}
            disabled={shrinking}
            className="mt-5 w-full"
            size="lg"
          >
            {shrinking ? 'Preparing photo…' : busy ? 'Uploading…' : 'Send to a pharmacist'}
          </Button>
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            A pharmacist usually replies within a few hours. You&apos;ll see their answer on this
            page — we&apos;ll never post it anywhere else.
          </p>
          <div className="mt-6">
            <PrescriptionDisclaimer variant="full" />
          </div>
        </form>
      </Card>

      <h2 className="mb-3 mt-12 font-semibold text-gray-900 dark:text-gray-100">Your questions</h2>
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
            Snap or upload a prescription you don&apos;t follow — dosage, timing, what a drug is
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
                        {u.patientNote ?? (u.hasAudio ? 'Voice note' : 'Prescription question')}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        {/* A marker, not a player. The list is a summary,
                            and twenty players would each want their own
                            slice of somebody's data bundle. */}
                        {u.hasAudio && (
                          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                            <IconMic width={11} height={11} />
                            {u.audioDurationSec ? formatDuration(u.audioDurationSec) : 'Voice'}
                            <span className="text-gray-400 dark:text-gray-600">·</span>
                          </span>
                        )}
                        {new Date(u.createdAt).toLocaleDateString()}
                        {u.pharmacistName ? ` · ${u.pharmacistName}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {u.unreadCount > 0 && (
                        <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white dark:bg-emerald-500 dark:text-emerald-950">
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
