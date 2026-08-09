'use client'

import { IconMic } from '@/components/ui/icons'
import { formatDuration } from '@/lib/audioNotes'

/**
 * Plays a voice note attached to a prescription query or reply.
 *
 * Native controls rather than a custom player: they are already keyboard
 * accessible, already work with a screen reader, already have the scrub
 * bar people expect, and cost nothing to ship.
 *
 * preload="none" is the load-bearing part. On a metered Nigerian data
 * plan a pharmacist opening a queue of twenty threads should not silently
 * download twenty recordings they may never play — the audio is fetched
 * on the first tap and not before.
 */
export default function AudioNotePlayer({
  src,
  seconds,
  label = 'Voice note',
  tone = 'neutral',
}: {
  src: string
  seconds?: number | null
  label?: string
  /** `own` reads on the patient's own emerald message bubble. */
  tone?: 'neutral' | 'own'
}) {
  const head =
    tone === 'own'
      ? 'text-white/90'
      : 'text-gray-600 dark:text-gray-400'

  return (
    <div>
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${head}`}>
        <IconMic width={12} height={12} className="shrink-0" />
        {label}
        {typeof seconds === 'number' && seconds > 0 && <span>· {formatDuration(seconds)}</span>}
      </p>
      <audio src={src} controls preload="none" className="mt-1.5 w-full max-w-xs" />
    </div>
  )
}
