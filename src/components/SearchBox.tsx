'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { type DrugSuggestion, drugLabel } from '@/lib/types'
import Button from '@/components/ui/Button'
import { IconMic, IconPill, IconSearch, IconX } from '@/components/ui/icons'

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

/** Chrome/Android expose this prefixed; Firefox and older Safari not at all. */
function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

type Props = {
  onSelect: (drug: DrugSuggestion) => void
  onNoMatch: (query: string) => void
  disabled?: boolean
}

export default function SearchBox({ onSelect, onNoMatch, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [listening, setListening] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastPickedRef = useRef<DrugSuggestion | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  // Typing a drug name on a phone keyboard is the slowest part of the whole
  // flow, so offer dictation where the browser supports it. Read through
  // useSyncExternalStore so the server renders "unsupported" and the client
  // corrects it on hydration — no mismatch, no setState in an effect.
  const voiceSupported = useSyncExternalStore(
    () => () => {},
    () => Boolean(getSpeechRecognition()),
    () => false,
  )

  // Stop any in-flight dictation if the box unmounts mid-listen
  useEffect(() => () => recognitionRef.current?.abort(), [])

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const Recognition = getSpeechRecognition()
    if (!Recognition) return
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-NG'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript?.trim()
      if (said) setQuery(said)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  useEffect(() => {
    const q = query.trim()
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setSuggestions([])
        setOpen(false)
        return
      }
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        setSuggestions(data.drugs ?? [])
        setOpen(true)
        setHighlighted(0)
      } catch {
        // aborted or offline — keep previous suggestions
      }
    }, q.length < 2 ? 0 : 250)
    return () => clearTimeout(timer)
  }, [query])

  function pick(drug: DrugSuggestion) {
    lastPickedRef.current = drug
    setQuery(drugLabel(drug))
    setOpen(false)
    onSelect(drug)
  }

  async function submit() {
    if (open && suggestions.length > 0) {
      pick(suggestions[highlighted] ?? suggestions[0])
      return
    }
    const q = query.trim()
    if (q.length < 2) return
    setOpen(false)
    // Re-submitting the label of an already-picked drug just re-runs its search
    if (lastPickedRef.current && drugLabel(lastPickedRef.current) === q) {
      onSelect(lastPickedRef.current)
      return
    }
    // Last-chance server check before declaring "no match"
    try {
      const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.drugs?.length > 0) {
        pick(data.drugs[0])
        return
      }
    } catch {
      // fall through to no-match
    }
    onNoMatch(q)
  }

  return (
    <div className="relative">
      <div className="flex flex-col gap-2 min-[420px]:flex-row">
        <div className="relative min-w-0 flex-1">
          <IconSearch
            width={18}
            height={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlighted((h) => Math.min(h + 1, suggestions.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlighted((h) => Math.max(h - 1, 0))
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={'Try "Paracetamol", "Amoxicillin" or "Ventolin"'}
            className="w-full rounded-xl border-2 border-gray-300 bg-white py-3.5 pl-10 pr-4 text-base text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-950 dark:disabled:bg-gray-800"
            aria-label="Search for a drug"
            autoComplete="off"
            disabled={disabled}
          />
          {query && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/10"
            >
              <IconX width={16} height={16} />
            </button>
          )}
        </div>
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={disabled}
            aria-label={listening ? 'Stop listening' : 'Search by voice'}
            aria-pressed={listening}
            className={`flex min-h-[52px] shrink-0 items-center justify-center rounded-xl border px-4 transition-colors disabled:opacity-50 ${
              listening
                ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950'
                : 'border-gray-300 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-400 dark:hover:border-emerald-700 dark:hover:text-emerald-400'
            }`}
          >
            <IconMic width={20} height={20} />
          </button>
        )}
        <Button onClick={submit} disabled={disabled} size="lg" className="w-full shrink-0 min-[420px]:w-auto">
          Search
        </Button>
      </div>

      {listening && (
        <p className="animate-fade-in mt-2 flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-emerald-500" data-live="true" />
          Listening — say the medicine name
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-[1000] mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {suggestions.map((d, i) => (
            <li key={d.id}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(d)
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex w-full cursor-pointer items-center gap-3.5 px-4 py-3 text-left transition-colors ${
                  i === highlighted ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-white dark:bg-gray-900'
                }`}
              >
                <span className="flex shrink-0 items-center justify-center rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <IconPill width={18} height={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-gray-900 dark:text-gray-100">
                    {drugLabel(d)}
                  </span>
                  {d.brandNames.length > 0 && (
                    <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
                      {d.brandNames.join(', ')}
                    </span>
                  )}
                </span>
                {d.category && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                    {d.category}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
