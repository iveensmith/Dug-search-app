'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import RatingStars from '@/components/RatingStars'
import { RATING_DIMENSIONS, type RatingKey, type RatingSummary } from '@/lib/ratings'
import { IconX } from '@/components/ui/icons'

type Existing = Record<RatingKey, number> & { comment: string | null }

/**
 * Modal for rating one pharmacy across the four dimensions. Loads any
 * rating the user already left so re-rating edits it instead of adding a
 * second one (the API upserts on the same key).
 */
export default function RatePharmacyDialog({
  pharmacyId,
  pharmacyName,
  intro,
  skipIfRated,
  onClose,
  onSaved,
}: {
  pharmacyId: string
  pharmacyName: string
  /** Extra line above the scores, for context the user didn't ask for the dialog. */
  intro?: string
  /**
   * For prompts the user didn't open themselves (after collecting a
   * reservation). Someone who has already rated this pharmacy gets nothing
   * at all rather than an unsolicited "update your rating" — and nothing is
   * drawn until that's known, so there's no modal flashing open and shut.
   */
  skipIfRated?: boolean
  onClose: () => void
  onSaved?: (summary: RatingSummary) => void
}) {
  const [scores, setScores] = useState<Partial<Record<RatingKey, number>>>({})
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/pharmacies/${pharmacyId}/ratings`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const mine: Existing | null = data.mine
        if (mine) {
          if (skipIfRated) {
            onClose()
            return
          }
          setScores({
            availability: mine.availability,
            service: mine.service,
            pricing: mine.pricing,
            honesty: mine.honesty,
          })
          setComment(mine.comment ?? '')
          setEditing(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // onClose is a fresh closure each render; re-running this would refetch
    // on every parent render. The pharmacy is what the fetch depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId, skipIfRated])

  // Escape closes, like any dialog
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const complete = RATING_DIMENSIONS.every(({ key }) => scores[key])

  // After every hook, so the early exit can't change the hook order.
  if (loading && skipIfRated) return null

  async function submit() {
    if (!complete) {
      setError('Give every category a score')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/pharmacies/${pharmacyId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scores, comment }),
      })
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = '/login?next=/'
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not save your rating')
        return
      }
      onSaved?.(data.summary)
      onClose()
    } catch {
      setError('Network problem — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Rate ${pharmacyName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="animate-fade-up max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-50">
              {editing ? 'Update your rating' : (intro ?? 'Rate this pharmacy')}
            </p>
            <p className="truncate text-sm text-gray-600 dark:text-gray-400">{pharmacyName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="mt-5 space-y-4">
              {RATING_DIMENSIONS.map(({ key, label, hint }) => (
                <div key={key}>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
                  <div className="mt-1.5 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScores((s) => ({ ...s, [key]: n }))}
                        aria-label={`${label}: ${n} out of 5`}
                        aria-pressed={scores[key] === n}
                        className={`h-10 flex-1 cursor-pointer rounded-lg border text-sm font-semibold transition-colors ${
                          (scores[key] ?? 0) >= n
                            ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300 dark:border-gray-700 dark:text-gray-500'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label
                htmlFor="rating-comment"
                className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Anything to add? <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <Textarea
                id="rating-comment"
                rows={2}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Had my drug in stock and explained the dose clearly"
                className="text-sm"
              />
            </div>

            {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

            <Button onClick={submit} loading={busy} disabled={!complete} className="mt-4 w-full" size="lg">
              {busy ? 'Saving…' : editing ? 'Update rating' : 'Submit rating'}
            </Button>
            {/* Nobody asked for this dialog when it's a prompt, so give it a
                plain way out rather than only the X in the corner. */}
            {skipIfRated && (
              <button
                type="button"
                onClick={onClose}
                className="mt-2 w-full cursor-pointer py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Not now
              </button>
            )}
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Your rating is public and shown with your first name.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/** Compact summary used on pharmacy cards. */
export function RatingBadge({ value, count }: { value: number | null; count: number }) {
  return <RatingStars value={value} count={count} />
}
