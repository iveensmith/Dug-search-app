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
export type ButtonAccent = 'terracotta' | 'deep'

/**
 * `pill` is the default now: the design this app follows makes every
 * button fully rounded, and setting it here is what carries that into the
 * screens nobody redesigns by hand — the owner dashboard, the admin
 * tables, every dialog. `rounded` is kept for anything that needs to sit
 * flush in a group.
 *
 * A prop rather than a className override, for the reason spelled out
 * above: two radius utilities in one class list are settled by emission
 * order, not by which one you wrote last.
 */
export type ButtonShape = 'rounded' | 'pill'

const shapes: Record<ButtonShape, string> = {
  rounded: 'rounded-control',
  pill: 'rounded-full',
}

/**
 * Focus is drawn once, here, from the `focus` token — not per variant.
 * A focus ring that changes colour with the button it sits on is a ring
 * people have to re-learn on every screen.
 */
const base =
  'inline-flex items-center justify-center gap-2 font-semibold ' +
  'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ' +
  'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

const accented: Record<ButtonAccent, Record<'primary' | 'secondary' | 'outline', string>> = {
  terracotta: {
    // `bg-brand` / `text-on-brand` already carry the light↔dark swap: the
    // token resolves to terracotta-700-on-white in light and terracotta-500-with-
    // dark-text in dark, so there is no `dark:` class left to keep in sync.
    primary:
      'bg-brand text-on-brand shadow-card hover:bg-brand-hover hover:shadow-brand active:bg-brand-press',
    secondary:
      'bg-brand-soft text-brand-ink hover:bg-brand-soft/70 active:bg-brand-soft',
    outline:
      'border border-brand/60 text-brand-ink hover:bg-brand-soft active:bg-brand-soft',
  },
  // Same hue, several steps darker. White text rather than the near-black
  // the light variant uses — terracotta-800 is dark enough that dark text on
  // it fails contrast.
  deep: {
    primary:
      'bg-brand-800 text-white shadow-card hover:bg-brand-900 hover:shadow-brand active:bg-brand-950 dark:bg-brand-700 dark:hover:bg-brand-600 dark:active:bg-brand-800',
    secondary:
      'bg-brand-100 text-brand-900 hover:bg-brand-200 dark:bg-brand-800/35 dark:text-brand-100 dark:hover:bg-brand-800/50',
    outline:
      'border border-brand-800/60 text-brand-800 hover:bg-brand-50 dark:border-brand-600/60 dark:text-brand-300 dark:hover:bg-brand-700/15',
  },
}

const variants: Record<'ghost' | 'destructive', string> = {
  ghost: 'text-muted hover:bg-sunken hover:text-ink active:bg-sunken',
  destructive:
    'border border-danger/40 text-danger-ink hover:bg-danger-soft active:bg-danger-soft',
}

/**
 * Heights are floors, not fixed: `min-h` lets a button that wraps to two
 * lines grow instead of clipping. 44px on `md` is the WCAG 2.2 target-size
 * minimum, which the old `py-2.5` (≈38px) missed.
 */
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 py-2 text-caption',
  md: 'min-h-11 px-5 py-2.5 text-body',
  lg: 'min-h-13 px-6 py-3 text-body-lg',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  accent?: ButtonAccent
  shape?: ButtonShape
  loading?: boolean
}

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
  accent: ButtonAccent = 'terracotta',
  shape: ButtonShape = 'pill',
) {
  const look =
    variant === 'ghost' || variant === 'destructive' ? variants[variant] : accented[accent][variant]
  return `${base} ${shapes[shape]} ${look} ${sizes[size]} ${className}`.trim()
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', accent = 'terracotta', shape = 'pill', loading, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className, accent, shape)}
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
