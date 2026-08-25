'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import PasswordInput from '@/components/ui/PasswordInput'
import { setWelcomeName } from '@/components/ui/WelcomeToast'
import { HOME_BY_ROLE } from '@/lib/roles'
import { IconChevronRight, IconStore, IconUser } from '@/components/ui/icons'

type Portal = 'patient' | 'pharmacy'

/**
 * The two portals are two different doors, and typing a patient password
 * into the pharmacy one fails with a message that deliberately explains
 * nothing. Making the sides look different is how somebody notices which
 * one is open before they type — the tab colour alone is easy to miss on
 * a phone, so the card, the button and the link move with it.
 *
 * Both sides stay the app's green — a second hue made the owner form look
 * like a different product. The owner side is several steps darker
 * instead, which reads as "the same place, the staff entrance". Because a
 * shade is a weaker signal than a hue, the wording carries it too: the
 * chip names the account type, the subtitle changes, and the first field
 * says "Owner email".
 */
const PORTAL = {
  patient: {
    label: 'Patient',
    subtitle: 'Log in to your account',
    heading: 'Patient account',
    accent: 'terracotta' as const,
    tab: 'bg-brand text-on-brand',
    cardEdge: 'border-t-4 border-t-terracotta-500 dark:border-t-terracotta-400',
    text: 'text-brand-ink',
    chip: 'bg-brand-soft text-brand-ink',
    Icon: IconUser,
  },
  pharmacy: {
    label: 'Pharmacy owner',
    subtitle: 'Log in to manage your pharmacy',
    heading: 'Pharmacy owner account',
    accent: 'deep' as const,
    tab: 'bg-brand-deep text-on-brand-deep',
    cardEdge: 'border-t-4 border-t-terracotta-800 dark:border-t-terracotta-600',
    text: 'text-brand-ink',
    chip: 'bg-brand-soft text-brand-ink',
    Icon: IconStore,
  },
} as const

const actionCardClass =
  'group flex w-full cursor-pointer items-center gap-3.5 rounded-card border border-line bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-md'

// Each card takes the colour of the side it leads to, not the side you are
// on — so "Are you a patient?" stays green while you are looking at the
// indigo owner form, and the colour is telling you where the tap goes.
const CARD_ACCENT = {
  patient: {
    hover: 'hover:border-line-brand',
    icon: 'bg-brand-soft text-brand-ink group-hover:bg-terracotta-100 dark:group-hover:bg-terracotta-500/20',
    chevron: 'group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400',
  },
  pharmacy: {
    hover: 'hover:border-terracotta-700 dark:hover:border-terracotta-600',
    icon: 'bg-brand-soft text-brand-ink group-hover:bg-terracotta-200 dark:group-hover:bg-terracotta-800/50',
    chevron: 'group-hover:text-terracotta-800 dark:group-hover:text-terracotta-300',
  },
} as const

function ActionCardBody({
  icon,
  title,
  subtitle,
  leadsTo,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  leadsTo: Portal
}) {
  const a = CARD_ACCENT[leadsTo]
  return (
    <>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${a.icon}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {/* Wraps rather than truncates. Both subtitles are literals a few
            words long, so there is no runaway string to guard against —
            and Poppins runs about a quarter wider than the Open Sans this
            replaced, which was enough to start clipping "…takes a minute"
            on a phone. The two cards are stacked, so an uneven height
            costs nothing. */}
        <span className="block text-sm text-faint">{subtitle}</span>
      </span>
      <IconChevronRight
        width={18}
        height={18}
        className={`shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 dark:text-gray-600 ${a.chevron}`}
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
  const [busy, setBusy] = useState(false)

  const theme = PORTAL[portal]

  function switchPortal(to: Portal) {
    setPortal(to)
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, portal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
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
      <main className="animate-fade-up mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">
            {theme.subtitle}
          </p>
        </div>

        <div className="mb-4 flex overflow-hidden rounded-lg border border-line-strong text-sm">
          {(['patient', 'pharmacy'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => switchPortal(key)}
              aria-pressed={portal === key}
              className={`flex-1 cursor-pointer px-4 py-2 font-medium transition-colors ${
                portal === key
                  ? PORTAL[key].tab
                  : 'bg-surface text-muted'
              }`}
            >
              {PORTAL[key].label}
            </button>
          ))}
        </div>

        <Card className={theme.cardEdge}>
          {/* Says which door this is in words, not only in colour — the
              tab above is the same shape whichever side is chosen, and a
              colour on its own is no help to anyone who cannot see it. */}
          <p
            className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${theme.chip}`}
          >
            <theme.Icon width={13} height={13} />
            {theme.heading}
          </p>

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
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Link
                href="/forgot-password"
                className={`mt-1.5 inline-block text-xs font-medium underline underline-offset-2 ${theme.text}`}
              >
                Forgot password?
              </Link>
            </div>

            {/* One message for every kind of failure. The sign-up routes
                are linked below the form, permanently and for everyone —
                showing them only after a failed attempt would say which
                addresses are registered. */}
            {error && (
              <div className="rounded-control bg-danger-soft p-3">
                <p className="text-sm font-medium text-danger-ink">{error}</p>
              </div>
            )}

            <Button type="submit" accent={theme.accent} loading={busy} className="w-full" size="lg">
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </Card>

        <div className="mt-8 space-y-3">
          {portal === 'patient' ? (
            <>
              <Link href="/register" className={`${actionCardClass} ${CARD_ACCENT.patient.hover}`}>
                <ActionCardBody
                  icon={<IconUser width={20} height={20} />}
                  title="Create a patient account"
                  subtitle="New here? It's free and takes a minute"
                  leadsTo="patient"
                />
              </Link>
              <button type="button" onClick={() => switchPortal('pharmacy')} className={`${actionCardClass} ${CARD_ACCENT.pharmacy.hover}`}>
                <ActionCardBody
                  icon={<IconStore width={20} height={20} />}
                  title="Own a pharmacy?"
                  subtitle="Switch to the pharmacy portal"
                  leadsTo="pharmacy"
                />
              </button>
            </>
          ) : (
            <>
              <Link href="/pharmacy/register" className={`${actionCardClass} ${CARD_ACCENT.pharmacy.hover}`}>
                <ActionCardBody
                  icon={<IconStore width={20} height={20} />}
                  title="Add your pharmacy outlet"
                  subtitle="New pharmacy? Get discovered by patients"
                  leadsTo="pharmacy"
                />
              </Link>
              <button type="button" onClick={() => switchPortal('patient')} className={`${actionCardClass} ${CARD_ACCENT.patient.hover}`}>
                <ActionCardBody
                  icon={<IconUser width={20} height={20} />}
                  title="Are you a patient?"
                  subtitle="Switch to the patient portal"
                  leadsTo="patient"
                />
              </button>
            </>
          )}
        </div>
      </main>
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
