'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Button from '@/components/ui/Button'
import { IconMic, IconTrash, IconX } from '@/components/ui/icons'
import { MAX_AUDIO_SECONDS, formatDuration, normaliseAudioType } from '@/lib/audioNotes'

/**
 * Records a spoken note, for patients who can say what is wrong far more
 * precisely than they can type it in English.
 *
 * Progressive enhancement: a browser without MediaRecorder or without a
 * microphone renders nothing at all, and the typed note beside it still
 * works. Nothing about the form depends on this existing.
 *
 * The recording is always played back before it can be sent. People
 * mumble, phones mishear which microphone to use, and a note the patient
 * never heard is one the pharmacist may not be able to either — better
 * they find that out here than after waiting for a reply.
 */

/** The first format this browser will actually record in. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus', // Chrome, Edge, Android
    'audio/webm',
    'audio/mp4', // Safari, iOS
    'audio/ogg;codecs=opus', // Firefox
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

export type RecordedNote = { blob: Blob; seconds: number }

export default function AudioNoteRecorder({
  value,
  onChange,
  disabled,
}: {
  value: RecordedNote | null
  onChange: (note: RecordedNote | null) => void
  disabled?: boolean
}) {
  // Read through useSyncExternalStore so the server renders "unsupported"
  // and the client corrects it on hydration — no mismatch, and no setState
  // in an effect. Same pattern as the dictation button in SearchBox.
  const supported = useSyncExternalStore(
    () => () => {},
    () =>
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      !!pickMimeType(),
    () => false,
  )
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Read inside the recorder's onstop, which closes over the render it was
  // created in — a ref is the only thing that sees the final count.
  const secondsRef = useRef(0)

  // An object URL per recording, revoked when it is replaced or dropped —
  // otherwise every re-record leaks the last one for the life of the page.
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value.blob) : null), [value])
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function cleanup() {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
  }

  // Releases the microphone if the page navigates away mid-recording —
  // without this the phone keeps showing a recording indicator.
  useEffect(() => cleanup, [])

  async function start() {
    setError('')
    const mimeType = pickMimeType()
    if (!mimeType) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []
      secondsRef.current = 0
      setSeconds(0)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const type = normaliseAudioType(mimeType) ?? 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        cleanup()
        setRecording(false)
        if (blob.size > 0 && secondsRef.current >= 1) {
          onChange({ blob, seconds: secondsRef.current })
        } else {
          // Under a second is a mis-tap, not a note.
          setError('That was too short — hold on and speak for a few seconds')
        }
      }

      recorder.start()
      setRecording(true)
      tickRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
        if (secondsRef.current >= MAX_AUDIO_SECONDS) recorder.stop()
      }, 1000)
    } catch {
      cleanup()
      setRecording(false)
      setError('Could not use the microphone — check your browser permissions')
    }
  }

  function stop() {
    recorderRef.current?.stop()
  }

  function discard() {
    if (recording) {
      // Drop what was captured rather than keeping it: this is the cancel
      // button, and a cancelled recording that still saved would be a
      // nasty surprise on a note about your own health.
      chunksRef.current = []
      recorderRef.current?.stop()
      setRecording(false)
      cleanup()
    }
    onChange(null)
    setSeconds(0)
    setError('')
  }

  if (!supported) return null

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
        Or say it out loud{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
      </p>

      {value && previewUrl ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Voice note · {formatDuration(value.seconds)}
            </p>
            <button
              type="button"
              onClick={discard}
              disabled={disabled}
              aria-label="Remove voice note"
              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            >
              <IconTrash width={15} height={15} />
            </button>
          </div>
          {/* Heard before it can be sent — see the note at the top. */}
          <audio src={previewUrl} controls className="mt-2 w-full" />
        </div>
      ) : recording ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/30">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
              <span className="pulse-dot h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
              Recording · {formatDuration(seconds)}
            </p>
            <span className="text-xs text-red-700/80 dark:text-red-400/80">
              up to {formatDuration(MAX_AUDIO_SECONDS)}
            </span>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Button type="button" size="sm" onClick={stop} className="flex-1">
              Stop
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={discard}>
              <IconX width={14} height={14} />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
        >
          <IconMic width={16} height={16} />
          Record a voice note
        </button>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!value && !recording && !error && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          Speak in whichever language is easiest — the pharmacist listens to it themselves.
        </p>
      )}
    </div>
  )
}
