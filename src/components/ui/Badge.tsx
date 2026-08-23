import { type ReactNode } from 'react'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

/**
 * Each tone is a soft fill plus its own readable ink, both from tokens, so
 * a badge carries the same contrast in light and dark without a `dark:`
 * class on every line. `brand` stays solid — it is the one tone that is a
 * claim rather than a status.
 */
const tones: Record<BadgeTone, string> = {
  success: 'bg-ok-soft text-ok-ink',
  warning: 'bg-warn-soft text-warn-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  neutral: 'bg-sunken text-muted',
  brand: 'bg-brand text-on-brand',
}

export default function Badge({ tone = 'neutral', className = '', children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
