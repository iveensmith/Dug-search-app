import { type ReactNode } from 'react'
import Link from 'next/link'
import { LogoMark } from '@/components/ui/Logo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import WelcomeToast from '@/components/ui/WelcomeToast'
import CheckEmailBanner from '@/components/ui/CheckEmailBanner'
import { IconLogOut } from '@/components/ui/icons'

type Props = {
  title: ReactNode
  subtitle?: ReactNode
  onLogout?: () => void
  backHref?: string
  /** Tailwind max-width of the page it sits above, so the bar's contents
   *  line up with the content column while the bar itself spans the
   *  viewport. */
  width?: string
}

/**
 * Compact top bar for logged-in app screens (pharmacy/admin/pharmacist
 * dashboards). Sticky, like SiteHeader — these are long scrolling lists,
 * and losing the logo and log-out on the way down was inconsistent with
 * every other page.
 *
 * It must be rendered outside the page's content column so the bar spans
 * the viewport; `width` then lines its contents back up with that column.
 */
export default function AppHeader({
  title,
  subtitle,
  onLogout,
  backHref = '/',
  width = 'max-w-2xl',
}: Props) {
  return (
    <>
    <header className="sticky top-0 z-50 border-b border-line bg-white/80 backdrop-blur-sm dark:bg-gray-950/80">
      <WelcomeToast />
      <div className={`mx-auto flex w-full ${width} items-center justify-between gap-3 px-4 py-4`}>
      <div className="flex min-w-0 items-center gap-3">
        {/* The mark is aria-hidden, so without a label this link reads as
            nothing at all — on every dashboard screen, which is where a
            keyboard user most needs a way back. */}
        <Link
          href={backHref}
          aria-label="MediQuest home"
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg"
        >
          <LogoMark size="sm" />
        </Link>
        {/* Two lines, not one with an ellipsis. On a phone this column is
            about 175px wide, and a title like "Connect your own software"
            needs 254px in Poppins — no type size closes that gap, so a
            single line could only ever hide half the heading. Clamped at
            two so a long title cannot keep growing a sticky bar, and a
            step smaller below `sm` to buy back some of the width Poppins
            costs over the Open Sans this replaced. */}
        <div className="min-w-0">
          <h1 className="line-clamp-2 text-base font-bold text-ink sm:text-lg">{title}</h1>
          {subtitle && <p className="line-clamp-2 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-faint transition-colors hover:bg-sunken hover:text-ink"
          >
            <IconLogOut width={15} height={15} />
            Log out
          </button>
        )}
        </div>
      </div>
    </header>
    {/* Below the sticky bar, not inside it: it is prominent on arrival and
        scrolls away like any other content, instead of holding a slice of
        a phone screen hostage until it is dismissed. */}
    <CheckEmailBanner />
    </>
  )
}
