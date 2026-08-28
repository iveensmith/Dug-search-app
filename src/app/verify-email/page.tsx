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
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <Card className="text-center">
        {/* The one bold line in each state is what the page is about, so it
            is the page's heading — there was no h1 at all before, which
            leaves a screen reader nothing to announce the page by. Tailwind
            resets heading size and weight, so these look unchanged. */}
        {state === 'working' && (
          <h1 className="text-sm text-muted">Confirming your email…</h1>
        )}

        {state === 'done' && (
          <>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand-ink">
              <IconCheck width={22} height={22} />
            </span>
            <h1 className="mt-3 font-display text-lg font-semibold text-ink">Email confirmed</h1>
            <p className="mt-1.5 text-sm text-muted">
              Thanks — we can reach you now if a pharmacist replies, or if you ever need to reset
              your password.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand"
            >
              Find medicine
            </Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warn-soft text-warn-ink">
              <IconAlertCircle width={22} height={22} />
            </span>
            <h1 className="mt-3 font-display text-lg font-semibold text-ink">
              Couldn&apos;t confirm that
            </h1>
            <p className="mt-1.5 text-sm text-muted">{error}</p>
            {/* Nothing is lost by this failing — say so, because a page
                that only reports an error implies something broke that
                needs fixing before the app will work. */}
            <p className="mt-3 text-sm text-muted">
              Your account still works either way. You can ask for a new link from your account
              page.
            </p>
            <Link
              href="/account"
              className="mt-5 inline-block rounded-control border border-terracotta-600/60 px-5 py-2.5 text-sm font-semibold text-brand-ink dark:border-terracotta-400/50"
            >
              Go to my account
            </Link>
          </>
        )}
      </Card>
    </main>
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
