'use client'

import { useEffect } from 'react'
import Button from '@/components/ui/Button'
import { activeFilterCount, NO_FILTERS, type Filters } from '@/lib/filters'
import { IconX } from '@/components/ui/icons'

const DISTANCES: [string, number | null][] = [
  ['Under 1 km', 1],
  ['Under 3 km', 3],
  ['Under 5 km', 5],
  ['Any', null],
]

const TOGGLES: [keyof Omit<Filters, 'maxKm'>, string][] = [
  ['openNow', 'Open now'],
  ['confirmedToday', 'Confirmed today'],
  ['open24h', 'Open 24 h'],
  ['rated4', 'Rated 4+'],
]

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors ${
        on
          ? 'border-brand bg-brand text-on-brand'
          : 'border-line bg-surface text-muted hover:border-line-brand hover:bg-brand-soft hover:text-brand-ink'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Bottom sheet of result filters. Edits a draft the caller owns, so the
 * list only changes when "Show results" is tapped — filters flickering the
 * list underneath while you're still choosing is disorienting on a phone.
 */
export default function ResultFilters({
  draft,
  setDraft,
  matchCount,
  onApply,
  onClose,
}: {
  draft: Filters
  setDraft: (f: Filters) => void
  matchCount: number
  onApply: () => void
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filter results"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="animate-fade-up max-h-[90dvh] w-full overflow-y-auto rounded-t-sheet bg-raised p-5 pb-8 shadow-modal sm:max-w-md sm:rounded-sheet">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Filter results</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-full p-1.5 text-faint hover:bg-sunken"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-faint">
          Distance
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DISTANCES.map(([label, km]) => (
            <Chip key={label} on={draft.maxKm === km} onClick={() => setDraft({ ...draft, maxKm: km })}>
              {label}
            </Chip>
          ))}
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-faint">
          Only show
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {TOGGLES.map(([key, label]) => (
            <Chip key={key} on={draft[key]} onClick={() => setDraft({ ...draft, [key]: !draft[key] })}>
              {label}
            </Chip>
          ))}
        </div>

        <Button className="mt-7 w-full" size="lg" onClick={onApply} disabled={matchCount === 0}>
          {matchCount === 0
            ? 'No pharmacy matches these filters'
            : `Show ${matchCount} ${matchCount === 1 ? 'result' : 'results'}`}
        </Button>
        {activeFilterCount(draft) > 0 && (
          <button
            onClick={() => setDraft(NO_FILTERS)}
            className="mt-3 w-full cursor-pointer text-sm font-semibold text-faint hover:text-brand-ink"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}
