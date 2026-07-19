'use client'

import { useState } from 'react'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { IconCheck } from '@/components/ui/icons'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })
    } finally {
      setBusy(false)
      setSent(true) // always show the same generic confirmation
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            We&apos;ll email you a link to choose a new one
          </p>
        </div>

        <Card>
          {sent ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <IconCheck width={22} height={22} />
              </div>
              <p className="mt-3 font-medium text-gray-900 dark:text-gray-100">Check your email</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                If an account exists for <span className="font-medium">{identifier}</span>, a reset
                link is on its way. It expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Email" htmlFor="identifier" hint="(password reset is email-only for now)">
                <Input
                  id="identifier"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" loading={busy} className="w-full" size="lg">
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link href="/login" className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
            Back to log in
          </Link>
        </p>
      </div>
      <SiteFooter />
    </div>
  )
}
