'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ displayName: '', contact: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const isEmail = form.contact.includes('@')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName || undefined,
          email: isEmail ? form.contact : undefined,
          phone: isEmail ? undefined : form.contact,
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Sign-up failed')
        return
      }
      router.push(searchParams.get('next') ?? '/prescriptions')
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <h1 className="text-center text-2xl font-bold text-emerald-700">
        <Link href="/">DrugFinder Uyo</Link>
      </h1>
      <p className="mt-1 text-center text-sm text-gray-600">Create a patient account</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Your name</label>
          <input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email or phone number</label>
          <input
            value={form.contact}
            onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            required
            placeholder="e.g. 0803 123 4567 or you@example.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Password (min 8 characters)</label>
          <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} autoComplete="new-password" className={inputCls} />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-emerald-700 underline">Log in</Link>
      </p>
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
