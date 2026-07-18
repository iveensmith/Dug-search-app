import { type ReactNode } from 'react'
import Link from 'next/link'
import { LogoMark } from '@/components/ui/Logo'
import { IconLogOut } from '@/components/ui/icons'

type Props = {
  title: ReactNode
  subtitle?: ReactNode
  onLogout?: () => void
  backHref?: string
}

/** Compact top bar for logged-in app screens (pharmacy/admin/pharmacist dashboards). */
export default function AppHeader({ title, subtitle, onLogout, backHref = '/' }: Props) {
  return (
    <header className="flex items-center justify-between gap-3 py-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={backHref} className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg">
          <LogoMark size="sm" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-50">{title}</h1>
          {subtitle && <p className="truncate text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {onLogout && (
        <button
          onClick={onLogout}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          <IconLogOut width={15} height={15} />
          Log out
        </button>
      )}
    </header>
  )
}
