import { isOpenNow, type HoursInfo } from '@/lib/hours'

/** Renders nothing if the pharmacy hasn't set hours — self-reported, not
 *  verified, see src/lib/hours.ts. */
export default function OpenStatusBadge({ open24h, opensAt, closesAt, className = '' }: HoursInfo & { className?: string }) {
  const open = isOpenNow({ open24h, opensAt, closesAt })
  if (open === null) return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        open
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
          : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {open ? 'Open now' : 'Closed'}
    </span>
  )
}
