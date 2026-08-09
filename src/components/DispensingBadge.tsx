import { dispensingClass, type DispensingTone } from '@/lib/dispensing'

/**
 * Whether a medicine needs a prescription.
 *
 * Renders nothing when the drug is unclassified, which is most of the
 * catalogue. That silence is load-bearing: an absent badge means "not
 * checked", and any placeholder here would quietly turn it into "no
 * prescription needed".
 *
 * "Prescription only" is amber rather than red. It is not a problem with
 * the medicine or the pharmacy, it is one more thing to bring — the tone
 * should read like the freshness stamp, not like an error. The other two
 * classes are quieter still, because for them the badge is only
 * reassurance and should never outweigh the drug's own name.
 */
const TONE: Record<DispensingTone, string> = {
  strong: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
  quiet: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  plain: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
}

export default function DispensingBadge({
  value,
  short = false,
  className = '',
}: {
  value: string | null | undefined
  /** Compact form ("Rx") for dense rows like the autocomplete list. */
  short?: boolean
  className?: string
}) {
  const c = dispensingClass(value)
  if (!c) return null

  return (
    <span
      // The short form drops the words, so the full label goes to the
      // accessible name — a screen reader should never just hear "Rx".
      aria-label={short ? c.label : undefined}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[c.tone]} ${className}`}
    >
      {short ? c.shortLabel : c.label}
    </span>
  )
}
