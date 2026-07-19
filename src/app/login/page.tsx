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

type Portal = 'patient' | 'pharmacy'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const [portal, setPortal] = useState<Portal>(next?.startsWith('/pharmacy') ? 'pharmacy' : 'patient')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      router.push(next ?? HOME_BY_ROLE[data.user.role] ?? '/')
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {portal === 'patient' ? 'Log in to your account' : 'Log in to manage your pharmacy'}
          </p>
        </div>

        <div className="mb-4 flex overflow-hidden rounded-lg border border-gray-300 text-sm dark:border-gray-700">
          <button
            type="button"
            onClick={() => setPortal('patient')}
            className={`flex-1 cursor-pointer px-4 py-2 font-medium transition-colors ${portal === 'patient' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
          >
            Patient
          </button>
          <button
            type="button"
            onClick={() => setPortal('pharmacy')}
            className={`flex-1 cursor-pointer px-4 py-2 font-medium transition-colors ${portal === 'pharmacy' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
          >
            Pharmacy owner
          </button>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label={portal === 'patient' ? 'Email or phone' : 'Owner email'} htmlFor="identifier">
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </Field>
            <div>
              <Field label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Link
                href="/forgot-password"
                className="mt-1.5 inline-block text-xs font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                Forgot password?
              </Link>
            </div>

            {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

            <Button type="submit" loading={busy} className="w-full" size="lg">
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </Card>

        {portal === 'patient' ? (
          <>
            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              New here?{' '}
              <Link href="/register" className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
                Create a patient account
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Own a pharmacy?{' '}
              <button
                type="button"
                onClick={() => setPortal('pharmacy')}
                className="cursor-pointer font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                Switch to the pharmacy portal
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              New pharmacy?{' '}
              <Link href="/pharmacy/register" className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
                Register it here
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Are you a patient?{' '}
              <button
                type="button"
                onClick={() => setPortal('patient')}
                className="cursor-pointer font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                Switch to the patient portal
              </button>
            </p>
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
