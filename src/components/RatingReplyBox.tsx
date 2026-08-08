'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'

export type Comment = {
  id: string
  comment: string
  createdAt: string
  author: string
  ownerReply: string | null
}

/**
 * The pharmacy's public answer to one patient comment.
 *
 * Collapsed to a link until it is wanted, so a long list of ratings is a
 * list of what patients said rather than a wall of empty text boxes.
 * Saving an empty string withdraws a reply that was already posted — the
 * route treats it that way too.
 */
export function ReplyBox({
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
