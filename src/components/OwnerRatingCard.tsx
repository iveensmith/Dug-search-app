'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import RatingStars from '@/components/RatingStars'
import { MIN_RATINGS_TO_SCORE, RATING_DIMENSIONS, type RatingSummary } from '@/lib/ratings'
import { IconAlertCircle } from '@/components/ui/icons'

type Comment = {
  id: string
  comment: string
  createdAt: string
  author: string
  ownerReply: string | null
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

/**
 * The dimension names as a sentence, read straight off RATING_DIMENSIONS.
 *
 * This paragraph used to spell them out by hand, and duly went stale the
 * moment two of them were renamed — an owner was still being told they
 * are judged on "drug availability" and "cost" while the bars below said
 * otherwise. Deriving it means the prose cannot disagree with the chart
 * above it again, and the count word follows the list too.
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

/**
 * Owner-facing view of their own rating: the score patients see, broken
 * down by dimension, plus the note explaining what they're judged on.
 */
function ReplyBox({
  pharmacyId,
  comment,
  onSaved,
}: {
  pharmacyId: string
  comment: Comment
  onSaved: (reply: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(comment.ownerReply ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const res = await fetch(`/api/pharmacies/${pharmacyId}/ratings/${comment.id}/reply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text }),
      })
      if (res.ok) {
        onSaved(text.trim() || null)
        setOpen(false)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-400"
      >
        {comment.ownerReply ? 'Edit your reply' : 'Reply publicly'}
      </button>
    )
  }

  return (
    <div className="mt-2">
      <Textarea
        rows={2}
        maxLength={500}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Answer the patient — this shows publicly under their comment"
        className="text-sm"
        aria-label="Your public reply"
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={save} loading={busy}>
          {busy ? 'Saving…' : 'Post reply'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

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
        {rated && <RatingStars value={summary.scored ? summary.overall : null} count={summary.count} size={16} />}
      </div>

      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
        <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
        <p>
          <span className="font-semibold">Patients rate your pharmacy</span> on{' '}
          {COUNT_WORDS[RATING_DIMENSIONS.length] ?? RATING_DIMENSIONS.length} things:{' '}
          {dimensionList()}. Your score shows on every search result, so keeping your stock list
          accurate and your prices fair directly affects how many patients choose you.
        </p>
      </div>

      {!rated ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          No ratings yet — they&apos;ll appear here as patients visit and rate you.
        </p>
      ) : (
        <>
          {!summary.scored && (
            <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
              Only you can see this so far. Patients see a score once you have{' '}
              {MIN_RATINGS_TO_SCORE} ratings — until then one bad visit can&apos;t define your shop.
            </p>
          )}
          <dl className="mt-4 space-y-2.5">
            {RATING_DIMENSIONS.map(({ key, label }) => {
              const value = summary.averages![key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <dt className="w-36 shrink-0 text-sm leading-tight text-gray-600 dark:text-gray-400">{label}</dt>
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
                    {c.ownerReply && (
                      <span className="mt-1.5 block border-l-2 border-emerald-500 pl-2.5 text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Your reply:
                        </span>{' '}
                        {c.ownerReply}
                      </span>
                    )}
                    <ReplyBox
                      pharmacyId={pharmacyId}
                      comment={c}
                      onSaved={(reply) =>
                        setComments((list) =>
                          list.map((x) => (x.id === c.id ? { ...x, ownerReply: reply } : x)),
                        )
                      }
                    />
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
