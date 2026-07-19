import Link from 'next/link'
import { LogoMark } from '@/components/ui/Logo'

export default function SiteFooter() {
  return (
    <footer className="bg-emerald-800 text-emerald-50 dark:bg-emerald-950">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-lg font-bold text-white">PharmaFinder</span>
          </div>
          <p className="mt-3 text-sm text-emerald-100/80">
            Helping patients across Nigeria find which nearby pharmacies have their medicine in
            stock — with directions and a licensed pharmacist a message away.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">For patients</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className="text-emerald-100/90 hover:text-white">Find medicine</Link></li>
            <li><Link href="/prescriptions" className="text-emerald-100/90 hover:text-white">Ask a pharmacist</Link></li>
            <li><Link href="/register" className="text-emerald-100/90 hover:text-white">Create an account</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">For pharmacies</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/pharmacy/register" className="text-emerald-100/90 hover:text-white">Add your pharmacy outlet</Link></li>
            <li><Link href="/login" className="text-emerald-100/90 hover:text-white">Pharmacy / staff login</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-emerald-700/60 dark:border-emerald-900">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-emerald-200/80">
          © {new Date().getFullYear()} PharmaFinder. Not a substitute for professional medical advice.
        </p>
      </div>
    </footer>
  )
}
