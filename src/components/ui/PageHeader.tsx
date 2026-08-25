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
  accent,
  lede,
  eyebrow,
  children,
  width = 'narrow',
}: {
  title: ReactNode
  /**
   * The tail of the heading, in the brand green — the same treatment the
   * home page gives "In Stock". Pass the phrase that says what the page is
   * for ("Ask A" + "Pharmacist"), and leave it off where there is no such
   * phrase: a heading built from a drug's name has no part worth picking
   * out, and colouring half of "Medicine Not Found" would put the brand
   * colour on the bad news.
   */
  accent?: ReactNode
  lede?: ReactNode
  /** A short label above the title. Only where there is a true one to give. */
  eyebrow?: ReactNode
  /** Badges, back links, anything that belongs with the title. */
  children?: ReactNode
  /** `narrow` matches the reading measure of the pages that use it; `wide` matches the home page. */
  width?: 'narrow' | 'wide'
}) {
  return (
    <header className="bg-terracotta-50 dark:bg-terracotta-950/25">
      <div
        className={`mx-auto w-full px-4 py-10 md:py-14 ${width === 'wide' ? 'max-w-5xl' : 'max-w-2xl'}`}
      >
        {eyebrow && (
          <p className="text-sm font-semibold text-brand-ink">{eyebrow}</p>
        )}
        {/* text-balance for the reason the home hero has it: these wrap on
            a phone, and an accented tail left alone on its own short line
            reads as a caption rather than part of the heading. */}
        <h1 className="mt-3 text-balance font-serif text-[2rem] font-normal leading-[1.1] tracking-tight text-ink sm:text-[2.4rem]">
          {title}
          {accent && (
            <>
              {' '}
              <span className="font-light italic text-brand-ink">{accent}</span>
            </>
          )}
        </h1>
        {lede && (
          <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">
            {lede}
          </p>
        )}
        {children}
      </div>
    </header>
  )
}
