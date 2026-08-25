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
    <footer className="bg-terracotta-800 text-terracotta-50 dark:bg-terracotta-950">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-lg font-bold text-white">MediQuest</span>
          </div>
          <p className="mt-3 text-sm text-terracotta-100/80">
            Helping patients across Nigeria find which nearby pharmacies have their medicine in
            stock — with directions and a licensed pharmacist a message away.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-200">For patients</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className="text-terracotta-100/90 hover:text-white">Find medicine</Link></li>
            <li><Link href="/prescriptions" className="text-terracotta-100/90 hover:text-white">Ask a pharmacist</Link></li>
            <li><Link href="/register" className="text-terracotta-100/90 hover:text-white">Create an account</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-200">For pharmacies</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/pharmacy/register" className="text-terracotta-100/90 hover:text-white">Add your pharmacy outlet</Link></li>
            <li><Link href="/login?portal=pharmacy" className="text-terracotta-100/90 hover:text-white">Pharmacy / staff login</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-200">Contact us</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 text-terracotta-100/90 hover:text-white"
              >
                <IconMessageCircle width={15} height={15} className="shrink-0" />
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <Link href="/prescriptions" className="text-terracotta-100/90 hover:text-white">
                Medicine question? Ask a pharmacist
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* The policies sit on the bottom rule rather than in the columns
          above: they belong on every page, but they are not one of the
          things somebody came here to do. */}
      <div className="border-t border-terracotta-700/60 dark:border-terracotta-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-terracotta-200">
            © {new Date().getFullYear()} MediQuest. Not a substitute for professional medical advice.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {LEGAL_PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="text-terracotta-100/90 underline-offset-4 hover:text-white hover:underline"
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
