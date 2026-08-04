'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { NIGERIAN_STATES, type NigerianStateValue } from '@/lib/states'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPharmacy = searchParams.get('type') === 'pharmacy'
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [homeState, setHomeState] = useState<NigerianStateValue | ''>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The API and the whole app store one displayName; the split is
          // for the form only, because "Your name" got half-filled.
          displayName: [form.firstName, form.lastName].map((v) => v.trim()).filter(Boolean).join(' ') || undefined,
          email: form.email,
          password: form.password,
          state: homeState || undefined,
          accountType: isPharmacy ? 'pharmacy' : 'patient',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Sign-up failed')
        return
      }
      router.push(searchParams.get('next') ?? (isPharmacy ? '/pharmacy/register' : '/prescriptions'))
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="animate-fade-up mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {isPharmacy ? 'Create a pharmacy owner account' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isPharmacy ? 'Then add your outlet — free, takes a minute' : 'For patients — free, takes a minute'}
          </p>
        </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="firstName">
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Last name" htmlFor="lastName">
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                autoComplete="family-name"
              />
            </Field>
          </div>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              autoComplete="username"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" hint="(min 8 characters)" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          {!isPharmacy && (
            <Field label="Your state" hint="(optional — speeds up search)" htmlFor="homeState">
              <Select
                id="homeState"
                value={homeState}
                onChange={(e) => setHomeState(e.target.value as NigerianStateValue)}
              >
                <option value="">Prefer not to say</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={busy} className="w-full" size="lg">
            {busy ? 'Creating account…' : 'Sign up'}
          </Button>
        </form>
      </Card>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link
            href={isPharmacy ? '/login?portal=pharmacy' : '/login'}
            className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
          >
            Log in
          </Link>
        </p>
      </div>
      <SiteFooter />
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
