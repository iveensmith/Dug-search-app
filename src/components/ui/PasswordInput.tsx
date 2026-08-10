'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { controlClass } from '@/components/ui/Field'
import { IconEye, IconEyeOff } from '@/components/ui/icons'

/**
 * A password box you can read back.
 *
 * Typing a password blind on a phone keyboard is how most sign-in
 * failures actually happen — an autocapitalised first letter, a
 * mistyped symbol, a keyboard that swallowed a character. The person
 * then gets "Incorrect email or password" and has no way to tell whether
 * they misremembered the password or merely mistyped it, which is a
 * miserable place to be one tap from a reset link.
 *
 * Hidden by default, always. The toggle is a deliberate act, so nothing
 * is exposed to whoever is stood behind them unless they ask for it.
 *
 * The button is type="button" — inside a form, a bare <button> submits,
 * and revealing your password by accidentally signing in is not the
 * intended behaviour.
 */
export default function PasswordInput({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        // Room for the button, so a long password never runs underneath it.
        className={`${controlClass} pr-12 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        // The label says what the button will do, not what the state is —
        // a screen reader user needs the action, and "password shown" on a
        // button reads as a claim rather than a control.
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        // Never focusable by tab: the natural path is password → submit,
        // and a reveal button in the middle of it is a trip hazard for
        // anyone using a keyboard or a screen reader.
        tabIndex={-1}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-2.5 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
      >
        {shown ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
      </button>
    </div>
  )
}
