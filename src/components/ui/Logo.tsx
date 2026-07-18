import Link from 'next/link'

const MARK_SIZES = { sm: 28, md: 36, lg: 44 } as const

export function LogoMark({ size = 'md' }: { size?: keyof typeof MARK_SIZES }) {
  const px = MARK_SIZES[size]
  return (
    <svg width={px} height={px} viewBox="0 0 40 40" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="40" height="40" rx="11" className="fill-emerald-600 dark:fill-emerald-500" />
      <path d="M20 11a9 9 0 100 18 9 9 0 000-18z" fill="white" fillOpacity="0.16" />
      <rect x="17.25" y="12" width="5.5" height="16" rx="1.5" fill="white" />
      <rect x="12" y="17.25" width="16" height="5.5" rx="1.5" fill="white" />
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
        <span className="block text-xl font-bold leading-tight tracking-tight text-gray-900 dark:text-gray-50">
          PharmaFinder
        </span>
        {tagline && (
          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{tagline}</span>
        )}
      </span>
    </span>
  )
  if (href === null) return content
  return (
    <Link href={href} className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg">
      {content}
    </Link>
  )
}
