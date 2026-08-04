'use client'

import { useCallback, useEffect, useState } from 'react'
import { drugLabel, type DrugSuggestion } from '@/lib/types'
import { IconClock, IconTrash } from '@/components/ui/icons'

type Row = { id: string; queryText: string; drug: DrugSuggestion | null }

/**
 * The signed-in patient's own recent searches, as one-tap chips. Repeat
 * prescriptions are the common case here — someone buying the same drug
 * every month shouldn't have to retype it. Renders nothing for logged-out
 * visitors (there's no history to show) or when there's none yet.
 */
export default function RecentSearches({
  onPick,
  disabled,
}: {
  onPick: (drug: DrugSuggestion) => void
  disabled?: boolean
}) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [cleared, setCleared] = useState(false)

  const load = useCallback(() => {
    fetch('/api/search-history')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setRows(json?.searches ?? []))
      .catch(() => setRows([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function clear() {
    setCleared(true)
    setRows([])
    await fetch('/api/search-history', { method: 'DELETE' }).catch(() => {})
  }

  // Most recent first, one chip per drug
  const unique: DrugSuggestion[] = []
  for (const r of rows ?? []) {
    if (!r.drug) continue
    if (unique.some((d) => d.id === r.drug!.id)) continue
    unique.push(r.drug)
    if (unique.length === 5) break
  }

  if (!rows || unique.length === 0 || cleared) return null

  return (
    <div>
      <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        You searched before
      </p>
      <div className="flex flex-wrap gap-2">
        {unique.map((drug) => (
          <button
            key={drug.id}
            type="button"
            onClick={() => onPick(drug)}
            disabled={disabled}
            title={drugLabel(drug)}
            className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
          >
            <IconClock width={13} height={13} className="shrink-0" />
            <span className="truncate">
              {drug.genericName} {drug.strength}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
        >
          <IconTrash width={13} height={13} />
          Clear
        </button>
      </div>
    </div>
  )
}
