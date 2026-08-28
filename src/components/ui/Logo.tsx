import Link from 'next/link'

const MARK_SIZES = { sm: 26, md: 34, lg: 42 } as const

export function LogoMark({ size = 'md' }: { size?: keyof typeof MARK_SIZES }) {
  const px = MARK_SIZES[size]
  return (
    <svg width={px} height={px} viewBox="0 0 40 40" fill="none" aria-hidden="true" className="shrink-0">
      {/* Tighter corner than v2 (rx 9, not 11): the mark should read as a
          stamp — something official — not a friendly app tile. */}
      <rect width="40" height="40" rx="9" className="fill-brand" />
      {/* A single clean pharmacy cross, no decorative disc behind it. */}
      <rect x="16.5" y="10.5" width="7" height="19" rx="1" fill="white" />
      <rect x="10.5" y="16.5" width="19" height="7" rx="1" fill="white" />
    </svg>
  )
}

type Props = {
  size?: keyof typeof MARK_SIZES
  href?: string | null
  tagline?: string
  className?: string
}

/** Brand mark + wordmark. Pass href={null} to render a non-link heading (e.g. inside a nav that's already a link target). */
export default function Logo({ size = 'md', href = '/', tagline, className = '' }: Props) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="text-left">
        <span className="block font-display text-xl font-semibold leading-tight tracking-[-0.03em] text-ink">
          MediQuest
        </span>
        {tagline && (
          <span className="block text-xs font-medium text-faint">{tagline}</span>
        )}
      </span>
    </span>
  )
  if (href === null) return content
  return (
    <Link href={href} className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg">
      {content}
    </Link>
  )
}
