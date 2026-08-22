import { type HTMLAttributes } from 'react'

/**
 * `radius` rather than a className override, for the reason spelled out in
 * Button: two utilities setting the same property are settled by the order
 * Tailwind emitted them, not the order they are written, so an override
 * wins or loses by luck. `lg` is the softer corner the home page's bands
 * use; `md` is what everything else has always had.
 */
const radii = {
  md: 'rounded-2xl',
  lg: 'rounded-3xl',
} as const

type Props = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean
  radius?: keyof typeof radii
}

export default function Card({
  padded = true,
  radius = 'md',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <div
      className={`${radii[radius]} border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${padded ? 'p-4' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
