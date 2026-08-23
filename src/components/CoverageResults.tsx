'use client'

import Link from 'next/link'
import Card from '@/components/ui/Card'
import StockPulse from '@/components/StockPulse'
import RatingStars from '@/components/RatingStars'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import OpenStatusBadge from '@/components/ui/OpenStatusBadge'
import { IconCheck, IconPhone, IconRoute, IconStore, IconX } from '@/components/ui/icons'
import { directionsUrl, drugLabel, stockFreshness, type CoverageResult, type DrugSuggestion } from '@/lib/types'

/**
 * The answer to "which one shop can I get all of this from".
 *
 * Every card lists the whole prescription, ticked and crossed, not just
 * what the shop has. A patient comparing three pharmacies needs to see the
 * same list in the same order on each one — showing only the hits would
 * make them count what is absent, which is the thing they are actually
 * deciding on.
 *
 * Nothing here is a substitute suggestion or a reservation. Those are
 * per-medicine decisions and belong on the single-medicine search, which
 * is one tap away through the drug name.
 */
export default function CoverageResults({
  onDirections,
  routeBusyId,
  drugs,
  results,
  onCall,
  copiedPhone,
}: {
  drugs: DrugSuggestion[]
  results: CoverageResult[]
  onCall: (e: React.MouseEvent<HTMLAnchorElement>, phone: string) => void
  copiedPhone: string
  /** Draws the route on the in-app map. Falls back to a Google Maps link
   *  when absent, which is what this did everywhere before. */
  onDirections?: (r: CoverageResult) => void
  routeBusyId?: string | null
}) {
  if (results.length === 0) {
    return (
      <Card className="text-center">
        <p className="font-semibold text-ink">
          No pharmacy near you lists any of these
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          Try searching for them one at a time — a shop that has only one of them still won&apos;t
          show up here, but it will show up on its own.
        </p>
      </Card>
    )
  }

  const best = results[0].matched

  return (
    <ul className="stagger space-y-4">
      {results.map((r) => {
        const has = new Set(r.drugIds)
        const complete = r.matched === drugs.length
        return (
          <li
            key={r.id}
            className="rounded-card border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-line-brand hover:shadow-sheet"
          >
            <div className="flex items-start gap-3.5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-card bg-brand-soft text-brand-ink">
                <IconStore width={24} height={24} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/pharmacies/${r.id}`}
                    className="truncate font-bold text-ink transition-colors hover:text-brand-ink"
                  >
                    {r.name}
                  </Link>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-faint">
                    {r.distanceKm.toFixed(1)} km
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-faint">
                  {r.address}
                  {r.lga ? ` · ${r.lga}` : ''}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {/* The count is the headline, so it leads and it is loud
                      when it is everything. */}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      complete
                        ? 'bg-brand text-on-brand'
                        : 'bg-brand-soft text-brand-ink'
                    }`}
                  >
                    {complete ? `All ${drugs.length}` : `${r.matched} of ${drugs.length}`}
                  </span>
                  <StockPulse stockUpdatedAt={r.stockUpdatedAt} />
                  <VerifiedBadge />
                  <OpenStatusBadge open24h={r.open24h} opensAt={r.opensAt} closesAt={r.closesAt} />
                </div>
              </div>
            </div>

            {/* The whole list every time, in the order the patient typed
                it, so the cards can be read against each other. */}
            <ul className="mt-3.5 space-y-1.5 border-t border-line-soft pt-3.5">
              {drugs.map((d) => {
                const stocked = has.has(d.id)
                return (
                  <li key={d.id} className="flex items-start gap-2 text-sm">
                    {stocked ? (
                      <IconCheck
                        width={15}
                        height={15}
                        className="mt-0.5 shrink-0 text-ok"
                      />
                    ) : (
                      <IconX
                        width={15}
                        height={15}
                        className="mt-0.5 shrink-0 text-line-strong"
                      />
                    )}
                    <Link
                      href={`/drugs/${d.id}`}
                      className={
                        stocked
                          ? 'text-ink underline-offset-2 hover:underline'
                          : 'text-faint underline-offset-2 hover:underline'
                      }
                    >
                      {drugLabel(d)}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="mt-3.5 flex items-center gap-2.5">
              <RatingStars value={r.ratingAvg} count={r.ratingCount} />
            </div>

            {/* The stamp is the oldest of the items this shop matched, so
                one stale line makes the whole card stale. Said plainly
                rather than hidden behind the badge. */}
            {stockFreshness(r.stockUpdatedAt).tone === 'stale' && (
              <p className="mt-3 text-xs text-warn-ink">
                At least one of these hasn&apos;t been confirmed in over a day — worth calling
                first.
              </p>
            )}

            {/* flex-wrap with flex-auto, not flex-1. A flex item's
                min-width is auto, so flex-1 (basis 0) cannot shrink
                "Directions" below its 141px content width — two of
                them overflowed the card at 360 and under, and pushed
                the whole page into a horizontal scroll. flex-auto
                sizes from content, so the pair wraps onto two rows
                exactly when they no longer fit and stays side by side
                when they do. */}
            <div className="mt-4 flex flex-wrap gap-2.5">
              <a
                href={`tel:${r.phone.replace(/\s/g, '')}`}
                onClick={(e) => onCall(e, r.phone)}
                aria-label={`Call ${r.name}`}
                className="flex flex-auto items-center justify-center gap-2 rounded-control border border-line px-4 py-2.5 text-sm font-semibold text-muted shadow-card transition-colors hover:border-line-brand hover:text-brand-ink"
              >
                <IconPhone width={16} height={16} />
                {copiedPhone === r.phone ? 'Copied ✓' : 'Call'}
              </a>
              {/* The multi-medicine results used to send people straight
                  out to Google Maps while the single-medicine ones drew
                  the route in the app — same button, same word, two
                  different behaviours. */}
              {onDirections ? (
                <button
                  type="button"
                  onClick={() => onDirections(r)}
                  disabled={routeBusyId === r.id}
                  className="flex flex-auto cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-card transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  <IconRoute width={16} height={16} />
                  {routeBusyId === r.id ? 'Finding…' : 'Directions'}
                </button>
              ) : (
                <a
                  href={directionsUrl(r.latitude, r.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-auto items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-card transition-colors hover:bg-brand-hover"
                >
                  <IconRoute width={16} height={16} />
                  Directions
                </a>
              )}
            </div>

            {/* Only worth saying on a shop that is not the best on offer —
                on the top card it would be discouraging noise. */}
            {!complete && r.matched < best && (
              <p className="mt-3 text-xs text-faint">
                Another pharmacy above has {best} of {drugs.length}.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
