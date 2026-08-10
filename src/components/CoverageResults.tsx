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
  drugs,
  results,
  onCall,
  copiedPhone,
}: {
  drugs: DrugSuggestion[]
  results: CoverageResult[]
  onCall: (e: React.MouseEvent<HTMLAnchorElement>, phone: string) => void
  copiedPhone: string
}) {
  if (results.length === 0) {
    return (
      <Card className="text-center">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          No pharmacy near you lists any of these
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-600 dark:text-gray-400">
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
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-800"
          >
            <div className="flex items-start gap-3.5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <IconStore width={24} height={24} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/pharmacies/${r.id}`}
                    className="truncate font-bold text-gray-900 transition-colors hover:text-emerald-700 dark:text-gray-50 dark:hover:text-emerald-400"
                  >
                    {r.name}
                  </Link>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-500 dark:text-gray-400">
                    {r.distanceKm.toFixed(1)} km
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {r.address}
                  {r.lga ? ` · ${r.lga}` : ''}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {/* The count is the headline, so it leads and it is loud
                      when it is everything. */}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      complete
                        ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
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
            <ul className="mt-3.5 space-y-1.5 border-t border-gray-100 pt-3.5 dark:border-gray-800">
              {drugs.map((d) => {
                const stocked = has.has(d.id)
                return (
                  <li key={d.id} className="flex items-start gap-2 text-sm">
                    {stocked ? (
                      <IconCheck
                        width={15}
                        height={15}
                        className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      />
                    ) : (
                      <IconX
                        width={15}
                        height={15}
                        className="mt-0.5 shrink-0 text-gray-300 dark:text-gray-600"
                      />
                    )}
                    <Link
                      href={`/drugs/${d.id}`}
                      className={
                        stocked
                          ? 'text-gray-900 underline-offset-2 hover:underline dark:text-gray-100'
                          : 'text-gray-400 underline-offset-2 hover:underline dark:text-gray-500'
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
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                At least one of these hasn&apos;t been confirmed in over a day — worth calling
                first.
              </p>
            )}

            <div className="mt-4 flex gap-2.5">
              <a
                href={`tel:${r.phone.replace(/\s/g, '')}`}
                onClick={(e) => onCall(e, r.phone)}
                aria-label={`Call ${r.name}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
              >
                <IconPhone width={16} height={16} />
                {copiedPhone === r.phone ? 'Copied ✓' : 'Call'}
              </a>
              <a
                href={directionsUrl(r.latitude, r.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
              >
                <IconRoute width={16} height={16} />
                Directions
              </a>
            </div>

            {/* Only worth saying on a shop that is not the best on offer —
                on the top card it would be discouraging noise. */}
            {!complete && r.matched < best && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Another pharmacy above has {best} of {drugs.length}.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
