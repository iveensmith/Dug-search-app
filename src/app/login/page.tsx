'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { setWelcomeName } from '@/components/ui/WelcomeToast'
import { HOME_BY_ROLE } from '@/lib/roles'
import { IconChevronRight, IconStore, IconUser } from '@/components/ui/icons'

type Portal = 'patient' | 'pharmacy'

const actionCardClass =
  'group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-700'

function ActionCardBody({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:group-hover:bg-emerald-500/20">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gray-900 dark:text-gray-50">{title}</span>
        <span className="block truncate text-sm text-gray-500 dark:text-gray-400">{subtitle}</span>
      </span>
      <IconChevronRight
        width={18}
        height={18}
        className="shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-gray-600 dark:group-hover:text-emerald-400"
      />
    </>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const [portal, setPortal] = useState<Portal>(
    searchParams.get('portal') === 'pharmacy' || next?.startsWith('/pharmacy')
      ? 'pharmacy'
      : 'patient',
  )
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // Set when the email has no account on this side of the app — turns the
  // error into a link to the right sign-up form instead of a dead end.
  const [needsAccount, setNeedsAccount] = useState<Portal | null>(null)
  const [busy, setBusy] = useState(false)

  function switchPortal(to: Portal) {
    setPortal(to)
    setError('')
    setNeedsAccount(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNeedsAccount(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, portal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        if (data.needsAccount === 'patient' || data.needsAccount === 'pharmacy') {
          setNeedsAccount(data.needsAccount)
        }
        return
      }
      setWelcomeName(data.user.displayName)
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
      <div className="animate-fade-up mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {portal === 'patient' ? 'Log in to your account' : 'Log in to manage your pharmacy'}
          </p>
        </div>

        <div className="mb-4 flex overflow-hidden rounded-lg border border-gray-300 text-sm dark:border-gray-700">
          <button
            type="button"
            onClick={() => switchPortal('patient')}
            className={`flex-1 cursor-pointer px-4 py-2 font-medium transition-colors ${portal === 'patient' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
          >
            Patient
          </button>
          <button
            type="button"
            onClick={() => switchPortal('pharmacy')}
            className={`flex-1 cursor-pointer px-4 py-2 font-medium transition-colors ${portal === 'pharmacy' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
          >
            Pharmacy owner
          </button>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label={portal === 'patient' ? 'Email' : 'Owner email'} htmlFor="identifier">
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

            {error && (
              <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/40">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
                {needsAccount === 'pharmacy' && (
                  <Link
                    href={`/register?type=pharmacy&next=${encodeURIComponent(next ?? '/pharmacy')}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-red-800 underline underline-offset-2 dark:text-red-300"
                  >
                    Create a pharmacy account
                    <IconChevronRight width={15} height={15} />
                  </Link>
                )}
                {needsAccount === 'patient' && (
                  <Link
                    href={`/register?next=${encodeURIComponent(next ?? '/')}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-red-800 underline underline-offset-2 dark:text-red-300"
                  >
                    Create a patient account
                    <IconChevronRight width={15} height={15} />
                  </Link>
                )}
              </div>
            )}

            <Button type="submit" loading={busy} className="w-full" size="lg">
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </Card>

        <div className="mt-8 space-y-3">
          {portal === 'patient' ? (
            <>
              <Link href="/register" className={actionCardClass}>
                <ActionCardBody
                  icon={<IconUser width={20} height={20} />}
                  title="Create a patient account"
                  subtitle="New here? It's free and takes a minute"
                />
              </Link>
              <button type="button" onClick={() => switchPortal('pharmacy')} className={actionCardClass}>
                <ActionCardBody
                  icon={<IconStore width={20} height={20} />}
                  title="Own a pharmacy?"
                  subtitle="Switch to the pharmacy portal"
                />
              </button>
            </>
          ) : (
            <>
              <Link href="/pharmacy/register" className={actionCardClass}>
                <ActionCardBody
                  icon={<IconStore width={20} height={20} />}
                  title="Add your pharmacy outlet"
                  subtitle="New pharmacy? Get discovered by patients"
                />
              </Link>
              <button type="button" onClick={() => switchPortal('patient')} className={actionCardClass}>
                <ActionCardBody
                  icon={<IconUser width={20} height={20} />}
                  title="Are you a patient?"
                  subtitle="Switch to the patient portal"
                />
              </button>
            </>
          )}
        </div>
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
