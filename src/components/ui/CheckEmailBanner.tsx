'use client'

import { useEffect, useState } from 'react'
import { IconMail, IconAlertCircle, IconX } from '@/components/ui/icons'

const KEY = 'df_check_email'

/**
 * Set by the sign-up form right before it redirects. Carries the address
 * and whether the mail actually left, so the banner can say "check your
 * inbox" only when there is something to check.
 */
export function setCheckEmail(email: string, sent: boolean) {
  if (email) sessionStorage.setItem(KEY, JSON.stringify({ email, sent }))
}

type Pending = { email: string; sent: boolean }

/**
 * Tells a brand-new account to go and confirm its address.
 *
 * A banner rather than a toast: this asks the person to leave and do
 * something in another app, and a message that fades after four seconds
 * is no use for that — they look away, come back, and there is no trace
 * that anything was ever sent. It stays until dismissed.
 *
 * Still not a wall. The page behind it is fully usable, and the wording
 * never implies otherwise — somebody who signed up because they need to
 * find a drug tonight should be able to get on with that.
 *
 * One-shot, keyed to sessionStorage the same way WelcomeToast is: shown
 * on whichever page the sign-up lands on, then cleared, so it never
 * reappears on a refresh. The standing reminder for an account that never
 * confirmed lives on /account, which is where somebody goes looking.
 */
export default function CheckEmailBanner() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  useEffect(() => {
    const stored = sessionStorage.getItem(KEY)
    if (!stored) return
    sessionStorage.removeItem(KEY)
    try {
      const parsed = JSON.parse(stored) as Pending
      if (!parsed?.email) return
      // Syncing from a one-shot browser storage flag set just before this
      // page loaded — not derived from any prop/state, so no render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(parsed)
    } catch {
      // A malformed flag is not worth a crash on the page someone just
      // signed up to reach.
    }
  }, [])

  if (!pending) return null

  async function resend() {
    setState('sending')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setState(res.ok ? 'sent' : 'failed')
    } catch {
      setState('failed')
    }
  }

  // Two genuinely different situations. Promising an email that never left
  // the building sends somebody to refresh an inbox forever.
  const failedToSend = !pending.sent

  return (
    <div
      role="status"
      className={`border-b px-4 py-2.5 ${
        failedToSend
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40'
          : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40'
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-start gap-2.5">
        <span
          className={`mt-0.5 shrink-0 ${
            failedToSend
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {failedToSend ? (
            <IconAlertCircle width={17} height={17} />
          ) : (
            <IconMail width={17} height={17} />
          )}
        </span>

        <div
          className={`min-w-0 flex-1 text-sm ${
            failedToSend
              ? 'text-amber-900 dark:text-amber-200'
              : 'text-emerald-900 dark:text-emerald-200'
          }`}
        >
          {failedToSend ? (
            <p>
              <span className="font-bold">Account created.</span>{' '}
              We couldn&apos;t send the confirmation email just now — you can ask for a new link any
              time from your account page.
            </p>
          ) : (
            <p>
              <span className="font-bold">Check your email.</span>{' '}
              We sent a confirmation link to{' '}
              {/* A JS string, not JSX text: JSX drops the leading space of a
                  text child that wraps to the next line, which jammed the
                  dash onto the end of the address. */}
              <span className="font-semibold break-all">{pending.email}</span>
              {' — look in spam if it isn’t there. Everything here works in the meantime.'}
            </p>
          )}

          {state === 'sent' ? (
            <p className="mt-1 font-semibold">Sent again — it should arrive shortly.</p>
          ) : state === 'failed' ? (
            <p className="mt-1 font-semibold">
              That didn&apos;t go through. Try again from your account page.
            </p>
          ) : (
            <button
              onClick={resend}
              disabled={state === 'sending'}
              className="mt-1 cursor-pointer font-bold underline underline-offset-2 disabled:opacity-60"
            >
              {state === 'sending' ? 'Sending…' : failedToSend ? 'Try sending it now' : 'Send it again'}
            </button>
          )}
        </div>

        <button
          onClick={() => setPending(null)}
          aria-label="Dismiss"
          className={`-m-1 shrink-0 cursor-pointer rounded-lg p-1 ${
            failedToSend
              ? 'text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40'
              : 'text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40'
          }`}
        >
          <IconX width={16} height={16} />
        </button>
      </div>
    </div>
  )
}
