'use client'

import { useEffect, useRef, useState } from 'react'
import { relativeTime } from '@/lib/types'
import { stateLabel } from '@/lib/states'

/**
 * The last handful of stock confirmations across the network, streaming
 * onto the home page.
 *
 * The whole promise of the product is that a listing is real *right now*.
 * The stat row proves scale and the floating card proves recency; this
 * proves the network is *working* — a dozen different areas, a dozen
 * different medicines, each one a pharmacy that just checked its shelf.
 *
 * Data from /api/activity: drug + area + time, never a shop name (see the
 * route). Re-fetches every 30s so a real confirmation shows up while
 * someone is still reading, and the relative times age on their own clock
 * even when the list has not changed. Renders nothing until it has data
 * and nothing ever if the request fails — an empty space beats a fake
 * feed.
 */

type Item = { at: string; drug: string; lga: string | null; state: string }

const REFRESH_MS = 30_000

export default function LiveActivityFeed() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [, bumpClock] = useState(0)
  const topKey = useRef<string>('')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/activity', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { items: Item[] } | null) => {
          if (cancelled || !data?.items?.length) return
          const nextTop = `${data.items[0].at}-${data.items[0].drug}`
          if (topKey.current && nextTop !== topKey.current) {
            setFlash(true)
            setTimeout(() => setFlash(false), 1600)
          }
          topKey.current = nextTop
          setItems(data.items)
        })
        .catch(() => {})

    load()
    const poll = setInterval(load, REFRESH_MS)
    const clock = setInterval(() => bumpClock((n) => n + 1), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [])

  if (!items) return null

  const HOUR = 3_600_000
  const DAY = 24 * HOUR
  const ages = items.map((i) => Date.now() - new Date(i.at).getTime())
  const lastHour = ages.filter((a) => a < HOUR).length
  const today = ages.filter((a) => a < DAY).length

  // If nothing on the network has been confirmed in a day, the section
  // cannot honestly claim to be live — so it doesn't show. Better a
  // shorter page than a "confirming as you read this" headline over a
  // feed whose freshest entry is from yesterday.
  if (today === 0) return null

  return (
    <section className="reveal border-b border-line bg-canvas">
      <div className="mx-auto grid w-full max-w-5xl items-start gap-10 px-4 py-16 md:py-24 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="flex items-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ok-ink">
            <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-ok" data-live="true" />
            Live on the network
          </p>
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-4xl">
            {lastHour > 0 ? (
              <>
                Pharmacies are confirming stock{' '}
                <span className="text-brand-ink">as you read this</span>
              </>
            ) : (
              <>
                Pharmacies confirm stock{' '}
                <span className="text-brand-ink">through the day</span>
              </>
            )}
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted">
            {lastHour > 0 ? (
              <>
                <span className="font-mono font-semibold text-ink tabular-nums">{lastHour}</span>{' '}
                {lastHour === 1 ? 'confirmation' : 'confirmations'} in the last hour.{' '}
              </>
            ) : today > 0 ? (
              <>
                <span className="font-mono font-semibold text-ink tabular-nums">{today}</span>{' '}
                {today === 1 ? 'pharmacy' : 'pharmacies'} confirmed stock in the last day.{' '}
              </>
            ) : null}
            Every result you see carries the moment its pharmacy last checked — nothing here is a
            guess.
          </p>
          <a
            href="#search"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
          >
            Search for your medicine
            <span aria-hidden="true">→</span>
          </a>
          <p className="mt-3 text-xs text-faint">Area and medicine only — a shop&apos;s own name is never shown here.</p>
        </div>

        {/* The stream. A fixed window with a soft fade top and bottom, so
            it reads as a slice of something continuous rather than a list
            that happens to have twelve rows. */}
        <div
          className={`relative overflow-hidden rounded-card border bg-surface shadow-raised transition-colors duration-500 ${
            flash ? 'border-brand/50' : 'border-line'
          }`}
        >
          <div
            className="max-h-[22rem] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]"
          >
            <ul className="reveal-stagger divide-y divide-line-soft">
              {items.map((it, i) => {
                const age = Date.now() - new Date(it.at).getTime()
                const recent = age < DAY
                return (
                  <li
                    key={`${it.at}-${it.drug}-${i}`}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors duration-700 ${
                      i === 0 && flash ? 'bg-brand-soft' : ''
                    }`}
                  >
                    <span
                      className={`pulse-dot h-2 w-2 shrink-0 rounded-full ${
                        recent ? 'bg-ok' : 'bg-line-strong'
                      }`}
                      data-live={age < HOUR || (i < 2 && recent)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                        {it.drug}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        confirmed in {it.lga ?? stateLabel(it.state)}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[0.6875rem] text-faint">
                      {relativeTime(it.at)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
