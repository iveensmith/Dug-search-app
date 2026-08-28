import { type ReactNode } from 'react'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

/**
 * Each tone is a soft fill plus its own readable ink, both from tokens, so
 * a badge carries the same contrast in light and dark without a `dark:`
 * class on every line. `brand` stays solid — it is the one tone that is a
 * claim rather than a status.
 */
const tones: Record<BadgeTone, string> = {
  success: 'bg-ok-soft text-ok-ink ring-1 ring-inset ring-ok/15',
  warning: 'bg-warn-soft text-warn-ink ring-1 ring-inset ring-warn/20',
  danger: 'bg-danger-soft text-danger-ink ring-1 ring-inset ring-danger/20',
  info: 'bg-info-soft text-info-ink ring-1 ring-inset ring-info/20',
  neutral: 'bg-sunken text-muted ring-1 ring-inset ring-line',
  brand: 'bg-brand text-on-brand',
}

export default function Badge({ tone = 'neutral', className = '', children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
