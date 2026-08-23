import { type ReactNode } from 'react'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import PageHeader from '@/components/ui/PageHeader'
import { LEGAL_PAGES } from '@/lib/legalPages'

/**
 * The shell the three policy pages share.
 *
 * Long-form legal text is the one place in this app where someone reads
 * rather than scans, so it gets a real reading measure (65 characters),
 * generous leading, and headings that are quiet enough not to interrupt.
 * The contents list is not decoration: these pages answer specific
 * questions — "can a pharmacist see my photo", "how do I delete this" —
 * and someone arriving with one of those should not have to read the
 * rest to find it.
 */
export function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mt-12 text-title-lg font-bold tracking-tight text-ink sm:text-h3">{title}</h2>
      <div className="mt-3 space-y-4 text-[0.975rem] leading-[1.75] text-muted">{children}</div>
    </section>
  )
}

/** A definition-style row, for "what we collect / why" tables. */
export function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-line py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  )
}

export default function LegalPage({
  title,
  accent,
  lede,
  updated,
  contents,
  children,
}: {
  title: string
  accent: string
  lede: string
  /** ISO date, rendered long-form. Change it whenever the text changes. */
  updated: string
  contents: { id: string; label: string }[]
  children: ReactNode
}) {
  const date = new Date(updated).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <main className="w-full flex-1 pb-20">
        <PageHeader title={title} accent={accent} lede={lede}>
          <p className="mt-5 text-caption font-semibold uppercase tracking-wide text-brand-ink">
            Last updated {date}
          </p>
        </PageHeader>

        <div className="mx-auto w-full max-w-[46rem] px-4 pt-10">
          <nav aria-label="On this page" className="rounded-card border border-line bg-surface p-5">
            <p className="text-caption font-bold uppercase tracking-wide text-faint">On this page</p>
            <ul className="mt-3 space-y-2 text-sm">
              {contents.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="font-medium text-brand-ink underline-offset-4 hover:underline"
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {children}

          {/* The three are one set and people arrive at the wrong one. */}
          <nav aria-label="Other policies" className="mt-16 border-t border-line pt-6">
            <p className="text-caption font-bold uppercase tracking-wide text-faint">
              The other policies
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {LEGAL_PAGES.filter((p) => p.label !== `${title} ${accent}`.trim()).map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="font-medium text-brand-ink underline-offset-4 hover:underline"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
