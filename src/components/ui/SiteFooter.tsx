import Link from 'next/link'
import { LogoMark } from '@/components/ui/Logo'
import { IconMessageCircle } from '@/components/ui/icons'
import { LEGAL_PAGES } from '@/lib/legalPages'

// PLACEHOLDER — no mailbox is receiving this yet. Swap it for the real
// support address once one exists; this constant is the only place it
// appears.
const CONTACT_EMAIL = 'hello@mediquest.ng'

export default function SiteFooter() {
  return (
    // Ink on paper, like the rest of the app — the old emerald slab was a
    // leftover from a palette the product no longer uses. A single green
    // hairline at the top is the only colour: it reads as the service's
    // through-line, not decoration.
    <footer className="border-t-2 border-brand bg-canvas text-muted">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <span className="font-display text-lg font-semibold tracking-[-0.03em] text-ink">
              MediQuest
            </span>
          </div>
          <p className="mt-3.5 max-w-xs text-sm leading-relaxed text-muted">
            Helping patients across Nigeria find which nearby pharmacies have their medicine in
            stock — with directions and a licensed pharmacist a message away.
          </p>
        </div>

        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-faint">
            For patients
          </p>
          <ul className="mt-3.5 space-y-2.5 text-sm">
            <li><Link href="/" className="text-muted transition-colors hover:text-brand-ink">Find medicine</Link></li>
            <li><Link href="/prescriptions" className="text-muted transition-colors hover:text-brand-ink">Ask a pharmacist</Link></li>
            <li><Link href="/register" className="text-muted transition-colors hover:text-brand-ink">Create an account</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-faint">
            For pharmacies
          </p>
          <ul className="mt-3.5 space-y-2.5 text-sm">
            <li><Link href="/pharmacy/register" className="text-muted transition-colors hover:text-brand-ink">Add your pharmacy outlet</Link></li>
            <li><Link href="/login?portal=pharmacy" className="text-muted transition-colors hover:text-brand-ink">Pharmacy / staff login</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-faint">
            Contact us
          </p>
          <ul className="mt-3.5 space-y-2.5 text-sm">
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 font-mono text-[0.8125rem] text-muted transition-colors hover:text-brand-ink"
              >
                <IconMessageCircle width={15} height={15} className="shrink-0" />
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <Link href="/prescriptions" className="text-muted transition-colors hover:text-brand-ink">
                Medicine question? Ask a pharmacist
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* The policies sit on the bottom rule rather than in the columns
          above: they belong on every page, but they are not one of the
          things somebody came here to do. */}
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-faint">
            © {new Date().getFullYear()} MediQuest. Not a substitute for professional medical advice.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {LEGAL_PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="text-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
