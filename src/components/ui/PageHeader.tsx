import { type ReactNode } from 'react'

/**
 * The band at the top of a page, in the language the home page set.
 *
 * The home page reads as a stack of full-width fields that alternate mint
 * and ground; a subpage that opens with a 20px title on the page colour
 * belongs to a different site. This is the same field, at the size a
 * subpage warrants.
 *
 * It renders inside <main>, not above it — the heading is the page's
 * content, and a <header> outside the landmark leaves a screen reader
 * user's first jump landing after the title. Its own container, too,
 * because a band cannot run edge to edge from inside a centred column, so
 * pages using this give <main> the full width and put the measure back on
 * the sections underneath.
 */
export default function PageHeader({
  title,
  lede,
  eyebrow,
  children,
  width = 'narrow',
}: {
  title: ReactNode
  lede?: ReactNode
  /** A short label above the title. Only where there is a true one to give. */
  eyebrow?: ReactNode
  /** Badges, back links, anything that belongs with the title. */
  children?: ReactNode
  /** `narrow` matches the reading measure of the pages that use it; `wide` matches the home page. */
  width?: 'narrow' | 'wide'
}) {
  return (
    <header className="bg-emerald-50 dark:bg-emerald-950/25">
      <div
        className={`mx-auto w-full px-4 py-10 md:py-14 ${width === 'wide' ? 'max-w-5xl' : 'max-w-2xl'}`}
      >
        {eyebrow && (
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
        )}
        <h1 className="mt-3 text-[2rem] font-bold leading-[1.1] tracking-tight text-gray-900 sm:text-[2.4rem] dark:text-gray-50">
          {title}
        </h1>
        {lede && (
          <p className="mt-4 text-[1.05rem] leading-relaxed text-gray-600 dark:text-gray-400">
            {lede}
          </p>
        )}
        {children}
      </div>
    </header>
  )
}
