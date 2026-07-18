'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

const HOME_BY_ROLE: Record<string, string> = {
  PHARMACY_OWNER: '/pharmacy',
  ADMIN: '/admin',
  PHARMACIST: '/pharmacist',
  PATIENT: '/',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
      const next = searchParams.get('next')
      router.push(next ?? HOME_BY_ROLE[data.user.role] ?? '/')
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Logo size="lg" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Log in to your account</p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email or phone" htmlFor="identifier">
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
          </Field>
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

          {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={busy} className="w-full" size="lg">
            {busy ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        New here?{' '}
        <Link href="/register" className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
          Create a patient account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
        Own a pharmacy?{' '}
        <Link href="/pharmacy/register" className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
          Register it here
        </Link>
      </p>
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
