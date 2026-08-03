'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import RatingStars from '@/components/RatingStars'
import { RATING_DIMENSIONS, type RatingSummary } from '@/lib/ratings'
import { IconAlertCircle } from '@/components/ui/icons'

type Comment = { id: string; comment: string; createdAt: string; author: string }

/**
 * Owner-facing view of their own rating: the score patients see, broken
 * down by dimension, plus the note explaining what they're judged on.
 */
export default function OwnerRatingCard({ pharmacyId }: { pharmacyId: string }) {
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [comments, setComments] = useState<Comment[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/pharmacies/${pharmacyId}/ratings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSummary(data.summary)
        setComments(data.comments ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pharmacyId])

  const rated = summary && summary.count > 0

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-gray-900 dark:text-gray-100">Your rating</p>
        {rated && <RatingStars value={summary.overall} count={summary.count} size={16} />}
      </div>

      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
        <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
        <p>
          <span className="font-semibold">Patients rate your pharmacy</span> on four things:{' '}
          <strong>drug availability</strong>, <strong>service</strong>, <strong>cost</strong> and{' '}
          <strong>honesty</strong>. Your score shows on every search result, so keeping your stock
          list accurate and your prices fair directly affects how many patients choose you.
        </p>
      </div>

      {!rated ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          No ratings yet — they&apos;ll appear here as patients visit and rate you.
        </p>
      ) : (
        <>
          <dl className="mt-4 space-y-2.5">
            {RATING_DIMENSIONS.map(({ key, label }) => {
              const value = summary.averages![key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <dt className="w-32 shrink-0 text-sm text-gray-600 dark:text-gray-400">{label}</dt>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                  <dd className="w-8 shrink-0 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {value.toFixed(1)}
                  </dd>
                </div>
              )
            })}
          </dl>

          {comments.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Recent comments
              </p>
              <ul className="mt-2 space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400 dark:text-gray-500">{c.author}:</span> &ldquo;
                    {c.comment}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
