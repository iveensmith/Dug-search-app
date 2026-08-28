import { isOpenNow, type HoursInfo } from '@/lib/hours'

/** Renders nothing if the pharmacy hasn't set hours — self-reported, not
 *  verified, see src/lib/hours.ts. */
export default function OpenStatusBadge({ open24h, opensAt, closesAt, className = '' }: HoursInfo & { className?: string }) {
  const open = isOpenNow({ open24h, opensAt, closesAt })
  if (open === null) return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ring-1 ring-inset ${
        open
          ? 'bg-ok-soft text-ok-ink ring-ok/15'
          : 'bg-sunken text-faint ring-line'
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-ok' : 'bg-line-strong'}`} />
      {open ? 'Open now' : 'Closed'}
    </span>
  )
}
