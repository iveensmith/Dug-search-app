'use client'

import { drugLabel, type DrugSuggestion } from '@/lib/types'
import { IconBookmark, IconX } from '@/components/ui/icons'

/**
 * The medicines this patient asked us to remember, as one-tap chips.
 *
 * Sits above recent searches rather than beside them because the two say
 * different things: recent is what happened, saved is what was chosen.
 * Somebody on a repeat prescription wants the second one to survive a
 * month of other searches pushing it out of the first.
 *
 * Renders nothing when there is nothing saved, and nothing at all for a
 * signed-out visitor — there is nowhere to keep it for them, and an empty
 * "Saved" heading is a promise the page cannot keep.
 */
export default function SavedDrugs({
  drugs,
  onPick,
  onRemove,
  disabled,
}: {
  drugs: DrugSuggestion[]
  onPick: (drug: DrugSuggestion) => void
  onRemove: (drug: DrugSuggestion) => void
  disabled?: boolean
}) {
  if (drugs.length === 0) return null

  return (
    <div className="mt-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <IconBookmark width={12} height={12} />
        Saved
      </p>
      <ul className="flex flex-wrap gap-2">
        {drugs.map((d) => (
          <li key={d.id}>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-3 pr-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <button
                type="button"
                onClick={() => onPick(d)}
                disabled={disabled}
                className="cursor-pointer disabled:opacity-50"
              >
                {drugLabel(d)}
              </button>
              <button
                type="button"
                onClick={() => onRemove(d)}
                aria-label={`Remove ${drugLabel(d)} from saved`}
                className="ml-1 cursor-pointer rounded-full p-1 text-emerald-700/70 transition-colors hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-400/70 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-200"
              >
                <IconX width={11} height={11} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
