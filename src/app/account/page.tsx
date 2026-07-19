'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { DASHBOARD_HREF, DASHBOARD_LABEL, ROLE_LABEL } from '@/lib/roles'
import { stateLabel } from '@/lib/states'

type Me = {
  id: string
  email: string | null
  phone: string | null
  displayName: string | null
  role: string
  state: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameMessage, setNameMessage] = useState('')
  const [nameError, setNameError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/auth/me')
    if (res.status === 401) {
      router.push('/login?next=/account')
      return
    }
    const data = await res.json()
    if (!data.user) {
      router.push('/login?next=/account')
      return
    }
    setMe(data.user)
    setDisplayName(data.user.displayName ?? '')
    setLoaded(true)
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setNameBusy(true)
    setNameError('')
    setNameMessage('')
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNameError(data.error ?? 'Could not save changes')
        return
      }
      setMe(data.user)
      setNameMessage('Saved')
    } catch {
      setNameError('Network problem — try again')
    } finally {
      setNameBusy(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordBusy(true)
    setPasswordError('')
    setPasswordMessage('')
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error ?? 'Could not change password')
        return
      }
      setPasswordMessage('Password changed')
      setCurrentPassword('')
      setNewPassword('')
    } catch {
      setPasswordError('Network problem — try again')
    } finally {
      setPasswordBusy(false)
    }
  }

  if (!loaded || !me) {
    return (
      <div className="flex min-h-dvh w-full flex-col">
        <SiteHeader />
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <header className="py-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">My account</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Your profile and login details</p>
        </header>

        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                  {me.displayName || 'No name set'}
                </p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {me.email ?? me.phone}
                  {me.state ? ` · ${stateLabel(me.state)}` : ''}
                </p>
              </div>
              <Badge tone="brand">{ROLE_LABEL[me.role] ?? me.role}</Badge>
            </div>
            <Link
              href={DASHBOARD_HREF[me.role] ?? '/'}
              className="text-sm font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
            >
              Go to {DASHBOARD_LABEL[me.role] ?? 'your dashboard'} →
            </Link>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Display name</h2>
            <form onSubmit={saveName} className="space-y-3">
              <Field label="Name" htmlFor="displayName">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </Field>
              {nameError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{nameError}</p>}
              {nameMessage && <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{nameMessage}</p>}
              <Button type="submit" loading={nameBusy} size="sm">
                Save
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Change password</h2>
            <form onSubmit={changePassword} className="space-y-3">
              <Field label="Current password" htmlFor="currentPassword">
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New password" hint="(min 8 characters)" htmlFor="newPassword">
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              {passwordError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{passwordError}</p>}
              {passwordMessage && (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{passwordMessage}</p>
              )}
              <Button type="submit" loading={passwordBusy} size="sm">
                Change password
              </Button>
            </form>
          </Card>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
