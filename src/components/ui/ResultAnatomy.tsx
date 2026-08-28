import VerifiedBadge from '@/components/ui/VerifiedBadge'
import RatingStars from '@/components/RatingStars'
import { IconStore, IconPhone, IconRoute, IconBookmark } from '@/components/ui/icons'

/**
 * "Read a result in one glance" — a real result card, marked up.
 *
 * Every doubt a first-time visitor has about a stock site is really the
 * same question: can I believe this? The FAQ answers it in prose; this
 * answers it by showing the card and naming what each signal on it
 * actually means. The card is built from the same badge components the
 * live results use, so it can't drift out of sync with them.
 */

function Marker({ n }: { n: number }) {
  return (
    <span className="inline-grid h-[1.15rem] w-[1.15rem] shrink-0 translate-y-[-1px] place-items-center rounded-full bg-brand text-[0.625rem] font-bold text-on-brand tabular-nums">
      {n}
    </span>
  )
}

const NOTES = [
  {
    n: 1,
    label: 'The stock heartbeat',
    text: 'A pulsing dot means a real pharmacy confirmed this item recently. Anything past a day stops pulsing and sorts below fresher listings — it is never sold to you as a guarantee.',
  },
  {
    n: 2,
    label: 'Verified',
    text: 'Every pharmacy you can see here has had its PCN licence reviewed and approved. Pending and rejected shops never appear in a search.',
  },
  {
    n: 3,
    label: 'Distance',
    text: 'Measured from where you actually are when you allow location — not from the state capital. Sort by Nearest and the closest shelf is the top card.',
  },
  {
    n: 4,
    label: 'How much is left',
    text: 'The pharmacy\'s own count, in terms you can act on — "in stock", "last few left". Shown only when they have said; silence is not dressed up as plenty.',
  },
] as const

export default function ResultAnatomy() {
  return (
    <section className="reveal border-y border-line bg-canvas">
      <div className="mx-auto w-full max-w-5xl px-4 py-16 md:py-24">
        <p className="flex items-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-ink">
          <span className="h-px w-7 shrink-0 bg-brand/50" />
          Reading a result
        </p>
        <h2 className="mt-4 max-w-xl text-balance font-display text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-4xl">
          Everything a result tells you,{' '}
          <span className="text-brand-ink">at a glance</span>
        </h2>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
          {/* The card — the real thing, static. */}
          <div className="overflow-hidden rounded-card border border-line border-l-2 border-l-brand bg-surface p-5 shadow-raised">
            <div className="flex items-start gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-field bg-brand-soft text-brand-ink">
                <IconStore width={22} height={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="truncate font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
                    Mercyland Pharmacy
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Marker n={3} />
                    <span className="font-mono text-[0.8125rem] font-medium tabular-nums text-faint">
                      0.4 km
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-faint">12 Ibom Plaza Road, Uyo · Uyo</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {/* Static replicas of the live badges — a diagram needs a
                      fixed "fresh" example, and the real components read
                      the clock, which a server-rendered illustration must
                      not. */}
                  <span className="flex items-center gap-1">
                    <Marker n={1} />
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft py-1 pl-2 pr-2.5 text-[0.6875rem] font-semibold text-ok-ink ring-1 ring-inset ring-ok/15">
                      <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-ok" data-live="true" />
                      <span className="font-mono text-[0.6875rem] tracking-tight">Confirmed 9 min ago</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Marker n={4} />
                    <span className="inline-flex items-center rounded-full bg-urgent-soft px-2 py-0.5 text-xs font-semibold text-urgent-ink">
                      Last few left
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Marker n={2} />
                    <VerifiedBadge />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-ok-ink ring-1 ring-inset ring-ok/15">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                    Open now
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3.5 flex items-center gap-2.5">
              <RatingStars value={4.6} count={23} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <span className="flex flex-auto items-center justify-center gap-2 rounded-control border border-line px-4 py-2.5 text-sm font-semibold text-ink">
                <IconPhone width={16} height={16} />
                Call
              </span>
              <span className="flex flex-auto items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand">
                <IconRoute width={16} height={16} />
                Directions
              </span>
            </div>
            <span className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-control border border-brand/40 px-4 py-2.5 text-sm font-semibold text-brand-ink">
              <IconBookmark width={16} height={16} />
              Reserve
            </span>
          </div>

          {/* The key. */}
          <ol className="space-y-6">
            {NOTES.map(({ n, label, text }) => (
              <li key={n} className="flex gap-4 border-b border-line-soft pb-6 last:border-b-0 last:pb-0">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand-soft font-display text-sm font-semibold tabular-nums text-brand">
                  {n}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold tracking-[-0.02em] text-ink">
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
