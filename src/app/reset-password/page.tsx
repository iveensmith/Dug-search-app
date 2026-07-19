'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { HOME_BY_ROLE } from '@/lib/roles'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords don’t match')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not reset password')
        return
      }
      router.push(HOME_BY_ROLE[data.user.role] ?? '/')
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <Card>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          This link is missing its reset token.{' '}
          <Link href="/forgot-password" className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
            Request a new one
          </Link>
          .
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="(min 8 characters)" htmlFor="password">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

        <Button type="submit" loading={busy} className="w-full" size="lg">
          {busy ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Choose a new password</h1>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  )
}
