'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import RatingStars from '@/components/RatingStars'
import LoadMore from '@/components/ui/LoadMore'
import { ReplyBox } from '@/components/RatingReplyBox'
import { MIN_RATINGS_TO_SCORE, RATING_DIMENSIONS, type RatingSummary } from '@/lib/ratings'
import { relativeTime } from '@/lib/types'
import { IconAlertCircle, IconChevronRight, IconStore } from '@/components/ui/icons'

type Rating = {
  id: string
  scores: Record<string, number>
  overall: number
  comment: string | null
  ownerReply: string | null
  createdAt: string
  author: string
}

const PAGE_SIZE = 20

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

/**
 * The dimension names as a sentence, read straight off RATING_DIMENSIONS.
 *
 * This paragraph used to spell them out by hand, and duly went stale the
 * moment two of them were renamed — an owner was still being told they
 * are judged on "drug availability" and "cost" while the bars below said
 * otherwise. Deriving it means the prose cannot disagree with the chart
 * beneath it again, and the count word follows the list too.
 *
 * formatToParts rather than format: it keeps the separators and the names
 * apart, so each name can stay bold.
 */
function dimensionList() {
  return new Intl.ListFormat('en', { type: 'conjunction' })
    .formatToParts(RATING_DIMENSIONS.map((d) => d.label.toLowerCase()))
    .map((part, i) =>
      part.type === 'element' ? <strong key={i}>{part.value}</strong> : <span key={i}>{part.value}</span>,
    )
}

export default function OwnerRatings() {
  const [pharmacyId, setPharmacyId] = useState<string | null>(null)
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (nextPage: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pharmacy/ratings?page=${nextPage}&limit=${PAGE_SIZE}`)
      if (!res.ok) {
        setFailed(true)
        return
      }
      const data = await res.json()
      setPharmacyId(data.pharmacyId)
      setSummary(data.summary)
      // Append on "load more", replace on the first page, so a refresh
      // never leaves two copies of page one on screen.
      setRatings((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]))
      setTotal(data.total ?? 0)
      setHasMore(Boolean(data.hasMore))
      setPage(nextPage)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(1), 0)
    return () => clearTimeout(timer)
  }, [load])

  function applyReply(id: string, reply: string | null) {
    setRatings((prev) => prev.map((r) => (r.id === id ? { ...r, ownerReply: reply } : r)))
  }

  return (
    <div className="animate-fade-up">
      {/* Same mint band as the dashboard. The fill stays raw for the
          reason bands always do; the copy on it is tokenised. */}
      <header className="bg-terracotta-50 dark:bg-terracotta-950/25">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
          <Link
            href="/pharmacy/overview"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
          >
            <IconChevronRight width={15} height={15} className="rotate-180" />
            Back to dashboard
          </Link>

          <h1 className="mt-3 font-serif text-[2rem] font-normal leading-[1.1] tracking-tight text-ink sm:text-[2.4rem]">
            Your Ratings
          </h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-8">

      {failed ? (
        <Card className="mt-6">
          <p className="text-sm text-muted">
            Could not load your ratings. Refresh to try again.
          </p>
        </Card>
      ) : summary === null ? (
        <div className="mt-6 space-y-3">
          <div className="h-36 animate-pulse rounded-card bg-sunken" />
          <div className="h-24 animate-pulse rounded-card bg-sunken" />
        </div>
      ) : summary.count === 0 ? (
        <Card className="mt-6 text-center">
          <IconStore width={26} height={26} className="mx-auto text-line-strong" />
          <p className="mt-2 font-medium text-ink">No ratings yet</p>
          <p className="mt-1 text-sm text-muted">
            They appear here as patients visit and rate you. Keeping your stock list accurate is the
            fastest way to earn good ones.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-bold text-ink">
                  {summary.overall!.toFixed(1)}
                  <span className="ml-1 text-base font-medium text-faint">
                    / 5
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  from {summary.count} {summary.count === 1 ? 'patient' : 'patients'}
                </p>
              </div>
              <RatingStars
                value={summary.scored ? summary.overall : null}
                count={summary.count}
                size={18}
              />
            </div>

            <div className="mt-3 flex items-start gap-2.5 rounded-control border border-info bg-info-soft p-3 text-xs leading-relaxed text-info-ink">
              <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0 text-info" />
              <p>
                <span className="font-semibold">Patients rate your pharmacy</span> on{' '}
                {COUNT_WORDS[RATING_DIMENSIONS.length] ?? RATING_DIMENSIONS.length} things:{' '}
                {dimensionList()}. Your score shows on every search result, so keeping your stock
                list accurate and your prices fair directly affects how many patients choose you.
              </p>
            </div>

            {!summary.scored && (
              <p className="mt-3 rounded-control bg-canvas p-3 text-sm text-muted">
                Only you can see this so far. Patients see a score once you have{' '}
                {MIN_RATINGS_TO_SCORE} ratings — until then one bad visit can&apos;t define your
                shop.
              </p>
            )}

            <dl className="mt-4 space-y-2.5">
              {RATING_DIMENSIONS.map(({ key, label }) => {
                const value = summary.averages![key]
                return (
                  <div key={key} className="flex items-center gap-3">
                    <dt className="w-36 shrink-0 text-sm leading-tight text-muted">
                      {label}
                    </dt>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
                        style={{ width: `${(value / 5) * 100}%` }}
                      />
                    </div>
                    <dd className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                      {value.toFixed(1)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </Card>

          <ul className="mt-4 space-y-3">
            {ratings.map((r) => (
              <li key={r.id}>
                <Card>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-ink">{r.author}</p>
                    <p className="text-xs text-faint">
                      {relativeTime(r.createdAt)}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <RatingStars value={r.overall} size={14} />
                    <span className="text-sm font-semibold tabular-nums text-muted">
                      {r.overall.toFixed(1)}
                    </span>
                  </div>

                  {r.comment ? (
                    <p className="mt-2 text-sm text-muted">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  ) : (
                    // Worth saying rather than leaving a gap: a bare score
                    // still counts towards the average above.
                    <p className="mt-2 text-sm italic text-faint">
                      Scored without a comment
                    </p>
                  )}

                  {r.ownerReply && (
                    <p className="mt-2 border-l-2 border-brand pl-3 text-sm text-muted">
                      <span className="font-semibold text-brand-ink">
                        Your reply:
                      </span>{' '}
                      {r.ownerReply}
                    </p>
                  )}

                  {/* Replies answer a comment, so there is nothing to
                      answer on a bare score — the reply route refuses
                      those too. */}
                  {r.comment && pharmacyId && (
                    <ReplyBox
                      pharmacyId={pharmacyId}
                      comment={{
                        id: r.id,
                        comment: r.comment,
                        createdAt: r.createdAt,
                        author: r.author,
                        ownerReply: r.ownerReply,
                      }}
                      onSaved={(reply) => applyReply(r.id, reply)}
                    />
                  )}
                </Card>
              </li>
            ))}
          </ul>

          <LoadMore
            shown={ratings.length}
            total={total}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={() => void load(page + 1)}
            noun="ratings"
          />
        </>
      )}
      </div>
    </div>
  )
}
