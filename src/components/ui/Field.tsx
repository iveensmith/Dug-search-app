import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, forwardRef } from 'react'

/**
 * 48px min-height (`min-h-12`) rather than a fixed py: comfortably above
 * the 44px touch minimum, and it holds when a select's option text is
 * taller than expected. `text-base` stays — anything under 16px makes iOS
 * Safari zoom the page on focus, which on a one-handed search is jarring.
 */
export const controlClass =
  'w-full min-h-12 rounded-field border border-line bg-surface px-4 py-3 text-base text-ink ' +
  'outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint ' +
  'focus:border-focus focus:ring-2 focus:ring-focus/25 ' +
  'disabled:bg-sunken disabled:text-faint disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/20'

export const labelClass = 'mb-1.5 block text-caption font-semibold text-muted'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${controlClass} ${className}`} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`${controlClass} appearance-none pr-10 ${className}`}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </div>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`${controlClass} ${className}`} {...props} />
  },
)

type FieldProps = {
  label: ReactNode
  hint?: ReactNode
  htmlFor: string
  /**
   * When set, the message is rendered below the control and wired to it via
   * aria-describedby, so a screen reader announces the problem with the
   * field rather than leaving it as loose text on the page. Pass
   * aria-invalid on the control itself to get the red border.
   */
  error?: ReactNode
  children: ReactNode
}

/** Label + control wrapper — pass the same `id` to the control inside. */
export function Field({ label, hint, htmlFor, error, children }: FieldProps) {
  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
        {hint && <span className="ml-1 font-normal text-faint">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-caption text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
