import { type HTMLAttributes } from 'react'

/**
 * `radius` rather than a className override, for the reason spelled out in
 * Button: two utilities setting the same property are settled by the order
 * Tailwind emitted them, not the order they are written, so an override
 * wins or loses by luck. `lg` is the softer corner the home page's bands
 * use; `md` is what everything else has always had.
 */
const radii = {
  md: 'rounded-card',
  lg: 'rounded-sheet',
} as const

type Props = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean
  radius?: keyof typeof radii
  /**
   * Cards that are themselves links or buttons get a hover lift. Static
   * content cards don't — movement on something you can't press reads as
   * a bug, not polish.
   */
  interactive?: boolean
}

export default function Card({
  padded = true,
  radius = 'md',
  interactive = false,
  className = '',
  children,
  ...props
}: Props) {
  const lift = interactive
    ? 'transition-[box-shadow,border-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-line-brand hover:shadow-lift active:translate-y-0 active:shadow-card'
    : ''
  return (
    <div
      className={`${radii[radius]} border border-line bg-surface shadow-card ${lift} ${padded ? 'p-4' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
