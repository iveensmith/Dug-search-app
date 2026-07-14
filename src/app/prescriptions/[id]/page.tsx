'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PrescriptionDisclaimer from '@/components/PrescriptionDisclaimer'

type Thread = {
  upload: {
    id: string
    status: 'PENDING' | 'CLAIMED' | 'ANSWERED' | 'CLOSED'
    patientNote: string | null
    patientName: string
    pharmacistName: string | null
    isMine: boolean
    canMessage: boolean
    canClaim: boolean
    createdAt: string
  }
  messages: {
    id: string
    text: string
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

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/prescriptions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (res.ok) {
        setText('')
        await load()
      }
    } finally {
      setBusy(false)
    }
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
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-gray-700">This conversation doesn&apos;t exist or you can&apos;t view it.</p>
        <Link href="/prescriptions" className="mt-4 inline-block text-emerald-700 underline">
          Back
        </Link>
      </div>
    )
  }
  if (!thread) return <p className="py-16 text-center text-gray-500">Loading conversation…</p>

  const { upload, messages } = thread
  const backHref = upload.isMine ? '/prescriptions' : '/pharmacist'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-4">
      <header className="flex items-center justify-between py-4">
        <div className="min-w-0">
          <h1 className="truncate font-bold text-gray-900">
            {upload.isMine
              ? upload.pharmacistName
                ? `Chat with ${upload.pharmacistName}`
                : 'Your prescription question'
              : `Question from ${upload.patientName}`}
          </h1>
          <p className="text-xs text-gray-500">
            {new Date(upload.createdAt).toLocaleString()} · {upload.status.toLowerCase()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {upload.status !== 'CLOSED' && (upload.isMine || upload.canMessage) && (
            <button onClick={close} className="text-sm text-gray-500 underline">
              Close
            </button>
          )}
          <Link href={backHref} className="text-sm text-emerald-700 underline">
            Back
          </Link>
        </div>
      </header>

      <PrescriptionDisclaimer />

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Uploaded prescription
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/prescriptions/${upload.id}/image`}
          alt="Uploaded prescription"
          className="max-h-80 w-full rounded-lg object-contain"
        />
        {upload.patientNote && (
          <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-700">
            <span className="font-medium">Patient&apos;s note:</span> {upload.patientNote}
          </p>
        )}
      </div>

      {upload.canClaim && (
        <button
          onClick={claim}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          Claim this question
        </button>
      )}

      <div className="mt-4 flex-1 space-y-2">
        {messages.length === 0 && upload.status === 'PENDING' && (
          <p className="py-6 text-center text-sm text-gray-500">
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
                  ? 'rounded-br-sm bg-emerald-600 text-white'
                  : 'rounded-bl-sm border border-gray-200 bg-white text-gray-900'
              }`}
            >
              {!m.mine && (
                <p className="text-xs font-semibold text-emerald-700">
                  {m.senderName}
                  {m.senderRole === 'PHARMACIST' ? ' · Pharmacist' : ''}
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              <p className={`mt-1 text-right text-[10px] ${m.mine ? 'text-emerald-100' : 'text-gray-400'}`}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {upload.canMessage ? (
        <form onSubmit={send} className="sticky bottom-0 mt-4 flex gap-2 bg-gray-50 py-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message…"
            maxLength={2000}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : upload.status === 'CLOSED' ? (
        <p className="mt-4 rounded-xl bg-gray-100 p-3 text-center text-sm text-gray-600">
          This conversation is closed.
        </p>
      ) : null}
    </div>
  )
}
