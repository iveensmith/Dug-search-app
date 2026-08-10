'use client'

import { useState } from 'react'
import { IconAlertCircle } from '@/components/ui/icons'

/**
 * Asks an unverified account to confirm its address.
 *
 * A prompt, not a gate. Everything on the site works without it, and the
 * wording says so — a notice that implies the app is broken until you act
 * would be a lie, and would push people to hunt for an email that may
 * never have arrived.
 *
 * Renders nothing once the address is confirmed, and nothing for an
 * account with no email at all.
 */
export default function VerifyEmailNotice({
  email,
  verified,
}: {
  email: string | null
  verified: boolean
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  if (!email || verified) return null

  async function resend() {
    setError('')
    setState('sending')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not send it — try again shortly.')
        setState('idle')
        return
      }
      setState('sent')
    } catch {
      setError('Network problem — try again.')
      setState('idle')
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
        <IconAlertCircle width={16} height={16} className="shrink-0" />
        Confirm your email
      </p>
      <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-200/90">
        We sent a link to <span className="font-semibold">{email}</span>. Confirming it means we can
        reach you when a pharmacist replies, and lets you reset your password if you forget it.
        Everything else works without it.
      </p>

      {state === 'sent' ? (
        <p className="mt-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Sent — check your inbox, and your spam folder.
        </p>
      ) : (
        <button
          onClick={resend}
          disabled={state === 'sending'}
          className="mt-2.5 cursor-pointer text-sm font-bold text-amber-900 underline underline-offset-2 disabled:opacity-60 dark:text-amber-300"
        >
          {state === 'sending' ? 'Sending…' : 'Send the link again'}
        </button>
      )}
      {error && <p className="mt-1.5 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  )
}
