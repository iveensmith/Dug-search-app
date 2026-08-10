'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import { IconAlertCircle, IconCheck } from '@/components/ui/icons'

/**
 * Where a verification link lands.
 *
 * Confirms on arrival rather than behind a button: the tap that opened
 * the email is already the person saying yes, and asking them to say it
 * twice is a step that exists only to make the page feel busy.
 */
function VerifyEmailBody() {
  const token = useSearchParams().get('token')
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working')
  const [error, setError] = useState('')

  const verify = useCallback(async () => {
    if (!token) {
      setState('failed')
      setError('That link is missing its code. Open the link from the email again.')
      return
    }
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('failed')
        setError(data.error ?? 'Could not confirm this address.')
        return
      }
      setState('done')
    } catch {
      setState('failed')
      setError('Network problem — open the link again in a moment.')
    }
  }, [token])

  useEffect(() => {
    const timer = setTimeout(verify, 0)
    return () => clearTimeout(timer)
  }, [verify])

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card className="text-center">
        {state === 'working' && (
          <p className="text-sm text-gray-600 dark:text-gray-400">Confirming your email…</p>
        )}

        {state === 'done' && (
          <>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <IconCheck width={22} height={22} />
            </span>
            <p className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-50">Email confirmed</p>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
              Thanks — we can reach you now if a pharmacist replies, or if you ever need to reset
              your password.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950"
            >
              Find medicine
            </Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              <IconAlertCircle width={22} height={22} />
            </span>
            <p className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-50">
              Couldn&apos;t confirm that
            </p>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{error}</p>
            {/* Nothing is lost by this failing — say so, because a page
                that only reports an error implies something broke that
                needs fixing before the app will work. */}
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Your account still works either way. You can ask for a new link from your account
              page.
            </p>
            <Link
              href="/account"
              className="mt-5 inline-block rounded-xl border border-emerald-600/60 px-5 py-2.5 text-sm font-semibold text-emerald-700 dark:border-emerald-400/50 dark:text-emerald-400"
            >
              Go to my account
            </Link>
          </>
        )}
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      {/* useSearchParams needs a Suspense boundary, same as login and reset. */}
      <Suspense fallback={null}>
        <VerifyEmailBody />
      </Suspense>
      <SiteFooter />
    </div>
  )
}
