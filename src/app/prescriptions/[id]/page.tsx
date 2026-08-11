'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PrescriptionDisclaimer from '@/components/PrescriptionDisclaimer'
import Card from '@/components/ui/Card'
import SiteFooter from '@/components/ui/SiteFooter'
import Button from '@/components/ui/Button'
import { IconSend } from '@/components/ui/icons'
import AudioNoteRecorder, { type RecordedNote } from '@/components/AudioNoteRecorder'
import AudioNotePlayer from '@/components/AudioNotePlayer'
import PrescriptionImage from '@/components/PrescriptionImage'

type Thread = {
  upload: {
    id: string
    status: 'PENDING' | 'CLAIMED' | 'ANSWERED' | 'CLOSED'
    patientNote: string | null
    hasAudio: boolean
    audioDurationSec: number | null
    patientName: string
    pharmacistName: string | null
    isMine: boolean
    canMessage: boolean
    canClaim: boolean
    createdAt: string
  }
  messages: {
    id: string
    text: string | null
    hasAudio: boolean
    audioDurationSec: number | null
    mine: boolean
    senderName: string
    senderRole: string
    createdAt: string
  }[]
}

export default function PrescriptionThreadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [thread, setThread] = useState<Thread | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [text, setText] = useState('')
  const [voiceNote, setVoiceNote] = useState<RecordedNote | null>(null)
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/prescriptions/${id}`)
    if (res.status === 401) {
      router.push(`/login?next=/prescriptions/${id}`)
      return
    }
    if (!res.ok) {
      setNotFound(true)
      return
    }
    setThread(await res.json())
  }, [id, router])

  // Initial load + light polling (in-app notification of replies)
  useEffect(() => {
    const timer = setTimeout(load, 0)
    const poll = setInterval(load, 7000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
    }
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [thread?.messages.length])

  // Set when the question was sent but the recording could not be stored.
  const [voiceNoteFailed, setVoiceNoteFailed] = useState(false)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('voiceNoteFailed')) return
    // Read once from the URL the previous page navigated to — not derived
    // from any prop or state, so there is no loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceNoteFailed(true)
    // Taken back out so a reload or a shared link does not repeat it.
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() && !voiceNote) return
    setBusy(true)
    try {
      // Multipart only when there is a recording to carry. A typed reply,
      // which is still most of them, keeps the plain JSON body.
      const init: RequestInit = voiceNote
        ? { method: 'POST', body: audioForm() }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim() }),
          }
      const res = await fetch(`/api/prescriptions/${id}/messages`, init)
      if (res.ok) {
        setText('')
        setVoiceNote(null)
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  function audioForm(): FormData {
    const form = new FormData()
    if (text.trim()) form.append('text', text.trim())
    if (voiceNote) {
      form.append('audio', voiceNote.blob, 'voice-note')
      form.append('audioDuration', String(voiceNote.seconds))
    }
    return form
  }

  async function claim() {
    setBusy(true)
    try {
      const res = await fetch(`/api/prescriptions/${id}/claim`, { method: 'POST' })
      if (!res.ok) alert((await res.json()).error ?? 'Could not claim')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    if (!confirm('Close this conversation?')) return
    await fetch(`/api/prescriptions/${id}/close`, { method: 'POST' })
    await load()
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-gray-700 dark:text-gray-300">This conversation doesn&apos;t exist or you can&apos;t view it.</p>
        <Link href="/prescriptions" className="mt-4 inline-block text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
          Back
        </Link>
      </main>
    )
  }
  if (!thread)
    return (
      <main className="py-16 text-center text-gray-500 dark:text-gray-400">
        <p>Loading conversation…</p>
      </main>
    )

  const { upload, messages } = thread
  const backHref = upload.isMine ? '/prescriptions' : '/pharmacist'

  return (
    <div className="flex min-h-dvh w-full flex-col">
    {/* The landmark a screen reader jumps to, and what keeps the thread
        title below a section heading rather than a second site banner —
        a <header> inside <main> is scoped to its section. */}
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4">
      {/* The question went through; the recording did not. Said plainly,
          because the alternative is a patient believing a pharmacist has
          heard something that was never delivered. */}
      {voiceNoteFailed && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-bold">Your voice note did not attach</p>
          <p className="mt-1">
            Everything else was sent. Record it again in a message below, or type your question —
            the pharmacist has not heard it yet.
          </p>
        </div>
      )}
      <header className="flex items-center justify-between gap-3 py-4">
        <div className="min-w-0">
          <h1 className="truncate font-bold text-gray-900 dark:text-gray-50">
            {upload.isMine
              ? upload.pharmacistName
                ? `Chat with ${upload.pharmacistName}`
                : 'Your prescription question'
              : `Question from ${upload.patientName}`}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(upload.createdAt).toLocaleString()} · {upload.status.toLowerCase()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {upload.status !== 'CLOSED' && (upload.isMine || upload.canMessage) && (
            <button onClick={close} className="cursor-pointer text-sm text-gray-500 underline underline-offset-2 dark:text-gray-400">
              Close
            </button>
          )}
          <Link href={backHref} className="text-sm text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
            Back
          </Link>
        </div>
      </header>

      <PrescriptionDisclaimer />

      <Card className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Uploaded prescription
        </p>
        {/* Below the fold — the header, status and note come first. Both
            sides of the conversation get the same viewer: the pharmacist
            needs to read the handwriting to answer, and the patient needs
            to check what they sent was legible. */}
        <PrescriptionImage
          src={`/api/prescriptions/${upload.id}/image`}
          alt="Uploaded prescription"
        />
        {upload.patientNote && (
          <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
            <span className="font-medium">Patient&apos;s note:</span> {upload.patientNote}
          </p>
        )}
        {/* With the prescription rather than in the conversation: this is
            part of the question being asked, and a pharmacist deciding
            whether to claim it should be able to hear it first. */}
        {upload.hasAudio && (
          <div className="mt-2 rounded-lg bg-gray-50 p-2 dark:bg-white/5">
            <AudioNotePlayer
              src={`/api/prescriptions/${upload.id}/audio`}
              seconds={upload.audioDurationSec}
              label="Patient's voice note"
            />
          </div>
        )}
      </Card>

      {upload.canClaim && (
        <Button onClick={claim} loading={busy} className="mt-4 w-full" size="lg">
          Claim this question
        </Button>
      )}

      <div className="mt-4 flex-1 space-y-2">
        {messages.length === 0 && upload.status === 'PENDING' && (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {upload.isMine
              ? 'A pharmacist will pick this up soon — replies appear here.'
              : 'Claim the question to start the conversation.'}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.mine
                  ? 'rounded-br-sm bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950'
                  : 'rounded-bl-sm border border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
              }`}
            >
              {!m.mine && (
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {m.senderName}
                  {m.senderRole === 'PHARMACIST' ? ' · Pharmacist' : ''}
                </p>
              )}
              {m.text && <p className="whitespace-pre-wrap text-sm">{m.text}</p>}
              {m.hasAudio && (
                <div className={m.text ? 'mt-2' : ''}>
                  <AudioNotePlayer
                    src={`/api/prescriptions/${upload.id}/messages/${m.id}/audio`}
                    seconds={m.audioDurationSec}
                    tone={m.mine ? 'own' : 'neutral'}
                  />
                </div>
              )}
              <p className={`mt-1 text-right text-[10px] ${m.mine ? 'text-emerald-100 dark:text-emerald-900' : 'text-gray-500 dark:text-gray-400'}`}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {upload.canMessage ? (
        <form onSubmit={send} className="sticky bottom-0 mt-4 bg-background py-3">
          {/* A follow-up question deserves the same answer as the first
              one. Without this, a patient who explained their symptoms by
              voice would have to type the moment the pharmacist asked
              anything back. */}
          <div className="mb-2">
            <AudioNoteRecorder value={voiceNote} onChange={setVoiceNote} disabled={busy} />
          </div>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={voiceNote ? 'Add a note with it (optional)…' : 'Type your message…'}
              maxLength={2000}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900"
            />
            <Button
              type="submit"
              disabled={!text.trim() && !voiceNote}
              loading={busy}
              size="lg"
              className="shrink-0"
            >
              <IconSend width={16} height={16} />
              Send
            </Button>
          </div>
        </form>
      ) : upload.status === 'CLOSED' ? (
        <p className="mt-4 rounded-xl bg-gray-100 p-3 text-center text-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
          This conversation is closed.
        </p>
      ) : null}
      </main>
      <SiteFooter />
    </div>
  )
}
