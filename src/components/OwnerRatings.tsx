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
    <div className="animate-fade-up py-8">
      <Link
        href="/pharmacy/overview"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        <IconChevronRight width={15} height={15} className="rotate-180" />
        Back to dashboard
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-50">
        Your ratings
      </h1>

      {failed ? (
        <Card className="mt-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Could not load your ratings. Refresh to try again.
          </p>
        </Card>
      ) : summary === null ? (
        <div className="mt-6 space-y-3">
          <div className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : summary.count === 0 ? (
        <Card className="mt-6 text-center">
          <IconStore width={26} height={26} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-2 font-medium text-gray-900 dark:text-gray-100">No ratings yet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            They appear here as patients visit and rate you. Keeping your stock list accurate is the
            fastest way to earn good ones.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                  {summary.overall!.toFixed(1)}
                  <span className="ml-1 text-base font-medium text-gray-500 dark:text-gray-400">
                    / 5
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  from {summary.count} {summary.count === 1 ? 'patient' : 'patients'}
                </p>
              </div>
              <RatingStars
                value={summary.scored ? summary.overall : null}
                count={summary.count}
                size={18}
              />
            </div>

            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
              <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
              <p>
                <span className="font-semibold">Patients rate your pharmacy</span> on{' '}
                {COUNT_WORDS[RATING_DIMENSIONS.length] ?? RATING_DIMENSIONS.length} things:{' '}
                {dimensionList()}. Your score shows on every search result, so keeping your stock
                list accurate and your prices fair directly affects how many patients choose you.
              </p>
            </div>

            {!summary.scored && (
              <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
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
                    <dt className="w-36 shrink-0 text-sm leading-tight text-gray-600 dark:text-gray-400">
                      {label}
                    </dt>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
                        style={{ width: `${(value / 5) * 100}%` }}
                      />
                    </div>
                    <dd className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
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
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.author}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {relativeTime(r.createdAt)}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <RatingStars value={r.overall} size={14} />
                    <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {r.overall.toFixed(1)}
                    </span>
                  </div>

                  {r.comment ? (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  ) : (
                    // Worth saying rather than leaving a gap: a bare score
                    // still counts towards the average above.
                    <p className="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
                      Scored without a comment
                    </p>
                  )}

                  {r.ownerReply && (
                    <p className="mt-2 border-l-2 border-emerald-500 pl-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
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
  )
}
