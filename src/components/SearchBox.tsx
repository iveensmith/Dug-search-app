'use client'

import { useEffect, useRef, useState } from 'react'
import { type DrugSuggestion, drugLabel } from '@/lib/types'
import Button from '@/components/ui/Button'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { IconSearch } from '@/components/ui/icons'

type Props = {
  onSelect: (drug: DrugSuggestion) => void
  onNoMatch: (query: string) => void
  disabled?: boolean
}

export default function SearchBox({ onSelect, onNoMatch, disabled }: Props) {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const lastPickedRef = useRef<DrugSuggestion | null>(null)

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
      <div className="flex gap-2">
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
            placeholder={t('search.placeholder')}
            className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-base text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900 dark:disabled:bg-gray-800"
            aria-label="Search for a drug"
            autoComplete="off"
            disabled={disabled}
          />
        </div>
        <Button onClick={submit} disabled={disabled} size="lg" className="shrink-0">
          {t('search.button')}
        </Button>
      </div>

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
                className={`block w-full cursor-pointer px-4 py-3 text-left transition-colors ${
                  i === highlighted ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-white dark:bg-gray-900'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">{drugLabel(d)}</span>
                {d.brandNames.length > 0 && (
                  <span className="block text-sm text-gray-500 dark:text-gray-400">
                    Brands: {d.brandNames.join(', ')}
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
