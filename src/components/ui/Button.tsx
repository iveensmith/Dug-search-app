import { type ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * How deep the brand green is drawn. The default is what nearly
 * everything uses; `deep` marks the pharmacy-owner side of the login, so
 * it is obvious which door you are knocking on without leaving the
 * palette the rest of the app lives in.
 *
 * It is a whole variant string rather than a className override on top of
 * the default one, because two background utilities in the same class
 * list are settled by the order Tailwind emitted them, not the order they
 * are written — so an override wins or loses by luck.
 */
export type ButtonAccent = 'emerald' | 'deep'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const accented: Record<ButtonAccent, Record<'primary' | 'secondary' | 'outline', string>> = {
  emerald: {
    primary:
      'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-600/25 active:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:active:bg-emerald-400 dark:text-emerald-950 dark:hover:shadow-emerald-400/20 focus-visible:ring-emerald-500',
    secondary:
      'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 focus-visible:ring-emerald-500',
    outline:
      'border border-emerald-600/60 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/50 dark:text-emerald-400 dark:hover:bg-emerald-400/10 focus-visible:ring-emerald-500',
  },
  // Same hue, several steps darker. White text rather than the near-black
  // the light variant uses — emerald-800 is dark enough that dark text on
  // it fails contrast.
  deep: {
    primary:
      'bg-emerald-800 text-white shadow-sm hover:bg-emerald-900 hover:shadow-md hover:shadow-emerald-800/25 active:bg-emerald-950 dark:bg-emerald-700 dark:hover:bg-emerald-600 dark:active:bg-emerald-600 dark:text-white dark:hover:shadow-emerald-700/25 focus-visible:ring-emerald-700',
    secondary:
      'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-800/35 dark:text-emerald-100 dark:hover:bg-emerald-800/50 focus-visible:ring-emerald-700',
    outline:
      'border border-emerald-800/60 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-600/60 dark:text-emerald-300 dark:hover:bg-emerald-700/15 focus-visible:ring-emerald-700',
  },
}

const variants: Record<'ghost' | 'destructive', string> = {
  ghost:
    'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 focus-visible:ring-gray-400',
  destructive:
    'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 focus-visible:ring-red-500',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  accent?: ButtonAccent
  loading?: boolean
}

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
  accent: ButtonAccent = 'emerald',
) {
  const look =
    variant === 'ghost' || variant === 'destructive' ? variants[variant] : accented[accent][variant]
  return `${base} ${look} ${sizes[size]} ${className}`.trim()
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', accent = 'emerald', loading, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className, accent)}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  )
})

export default Button
