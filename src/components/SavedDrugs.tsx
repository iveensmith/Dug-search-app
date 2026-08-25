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
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-faint">
        <IconBookmark width={12} height={12} />
        Saved
      </p>
      <ul className="flex flex-wrap gap-2">
        {drugs.map((d) => (
          <li key={d.id}>
            <span className="inline-flex items-center rounded-full border border-line-brand bg-brand-soft py-1 pl-3 pr-1 text-xs font-semibold text-brand-ink">
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
                className="ml-1 cursor-pointer rounded-full p-1 text-terracotta-700/70 transition-colors hover:bg-brand-soft hover:text-terracotta-900 dark:text-terracotta-400/70 dark:hover:text-terracotta-200"
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
