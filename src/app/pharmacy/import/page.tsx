'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/ui/AppHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { logout } from '@/lib/logout'
import { MAX_CSV_BYTES } from '@/lib/csv'
import type { ImportPreview, ImportRow, RowStatus } from '@/lib/inventoryImport'
import { IconAlertCircle, IconCheck, IconUpload, IconDownload } from '@/components/ui/icons'

/**
 * Bringing a stock file in, with a look at it first.
 *
 * The screen is built around one refusal: nothing is written until the
 * owner has seen what would be. A file is a fast way to publish several
 * hundred availability claims, and the person who can tell a wrong one
 * from a right one is the pharmacist, not this code — so the matching is
 * shown as a proposal they approve, correct or skip.
 */

const STATUS_LABEL: Record<RowStatus, string> = {
  matched: 'Ready',
  ambiguous: 'Needs a choice',
  unmatched: 'Not found',
  invalid: 'Unusable row',
  duplicate: 'Repeated',
}

const TEMPLATE = `Drug,Strength,Form,Brand,Quantity,Expiry,In stock
Amoxicillin/Clavulanate,625 mg,Tablet,Aquaclav,20,03/2027,yes
Paracetamol,500 mg,Tablet,Emzor,150,12/2026,yes
Artemether/Lumefantrine,20/120 mg,Tablet,Lonart,0,06/2027,no
`

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [choices, setChoices] = useState<Record<number, string>>({})
  const [skipped, setSkipped] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<number | null>(null)

  const readFile = useCallback(async (file: File) => {
    setError('')
    setPreview(null)
    setDone(null)
    setChoices({})
    setSkipped({})
    setFileName(file.name)

    if (file.size > MAX_CSV_BYTES) {
      setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 1 MB. Split it and import in parts.`,
      )
      return
    }

    setBusy(true)
    try {
      const csv = await file.text()
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'We could not read that file.')
        return
      }
      setPreview(data as ImportPreview)
    } catch {
      setError('Network problem — try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  /** Rows that will actually be written, after the owner's edits. */
  const toApply = useMemo(() => {
    if (!preview) return []
    return preview.rows
      .map((r) => {
        if (skipped[r.line]) return null
        const drugId = r.status === 'matched' ? r.drugId : choices[r.line]
        if (!drugId) return null
        return {
          drugId,
          quantity: r.quantity,
          brand: r.brand,
          expiryDate: r.expiryDate,
          inStock: r.inStock,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [preview, choices, skipped])

  async function apply() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: true, items: toApply }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'That did not go through.')
        return
      }
      setDone(data.written ?? toApply.length)
      setPreview(null)
    } catch {
      setError('Network problem — try again.')
    } finally {
      setBusy(false)
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'mediquest-stock-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <AppHeader
        backHref="/pharmacy"
        title="Import your stock list"
        subtitle="From a spreadsheet or a POS export"
        onLogout={logout}
        width="max-w-2xl"
      />

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        {done !== null ? (
          <Card className="mt-4 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <IconCheck width={22} height={22} />
            </span>
            <p className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-50">
              {done} {done === 1 ? 'medicine' : 'medicines'} updated
            </p>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
              Patients searching in your area can see them now.
            </p>
            <Button onClick={() => router.push('/pharmacy')} className="mt-5">
              Back to my stock
            </Button>
          </Card>
        ) : (
          <>
            <Card className="mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload a CSV of what you have. We will show you what it matched{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  before anything is saved
                </span>
                . Your file needs a column of medicine names; strength, form, brand, quantity and
                expiry are used if they are there.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) readFile(f)
                    e.target.value = ''
                  }}
                />
                <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                  <IconUpload width={16} height={16} />
                  {busy && !preview ? 'Reading…' : 'Choose a file'}
                </Button>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  <IconDownload width={16} height={16} />
                  Example file
                </button>
              </div>
              {fileName && (
                <p className="mt-2 truncate text-sm text-gray-500 dark:text-gray-400">{fileName}</p>
              )}
            </Card>

            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <IconAlertCircle width={18} height={18} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {preview && (
              <PreviewList
                preview={preview}
                choices={choices}
                skipped={skipped}
                onChoose={(line, drugId) => setChoices((c) => ({ ...c, [line]: drugId }))}
                onSkip={(line, v) => setSkipped((s) => ({ ...s, [line]: v }))}
              />
            )}
          </>
        )}
      </div>

      {preview && done === null && (
        <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/95">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-bold text-gray-900 dark:text-gray-100">{toApply.length}</span>{' '}
              will be saved
            </p>
            <Button onClick={apply} disabled={busy || toApply.length === 0}>
              {busy ? 'Saving…' : 'Save to my stock'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewList({
  preview,
  choices,
  skipped,
  onChoose,
  onSkip,
}: {
  preview: ImportPreview
  choices: Record<number, string>
  skipped: Record<number, boolean>
  onChoose: (line: number, drugId: string) => void
  onSkip: (line: number, v: boolean) => void
}) {
  const { counts } = preview
  const needsAttention = preview.rows.filter((r) => r.status !== 'matched')
  const ready = preview.rows.filter((r) => r.status === 'matched')

  return (
    <>
      <Card className="mt-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <Pill tone="good">{counts.matched} ready</Pill>
          {counts.ambiguous > 0 && <Pill tone="warn">{counts.ambiguous} need a choice</Pill>}
          {counts.unmatched > 0 && <Pill tone="warn">{counts.unmatched} not found</Pill>}
          {counts.duplicate > 0 && <Pill tone="mute">{counts.duplicate} repeated</Pill>}
          {counts.invalid > 0 && <Pill tone="mute">{counts.invalid} unusable</Pill>}
        </div>
        {preview.ignoredHeaders.length > 0 && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Columns we did not use: {preview.ignoredHeaders.join(', ')}
          </p>
        )}
      </Card>

      {needsAttention.length > 0 && (
        <div className="mt-4">
          <h2 className="px-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            Needs your attention ({needsAttention.length})
          </h2>
          <div className="mt-2 space-y-2">
            {needsAttention.map((r) => (
              <RowCard
                key={r.line}
                row={r}
                chosen={choices[r.line]}
                skipped={!!skipped[r.line]}
                onChoose={onChoose}
                onSkip={onSkip}
              />
            ))}
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <div className="mt-5">
          <h2 className="px-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            Ready to save ({ready.length})
          </h2>
          <div className="mt-2 space-y-2">
            {ready.map((r) => (
              <RowCard
                key={r.line}
                row={r}
                chosen={choices[r.line]}
                skipped={!!skipped[r.line]}
                onChoose={onChoose}
                onSkip={onSkip}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'good' | 'warn' | 'mute' }) {
  const tones = {
    good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    mute: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  }
  return <span className={`rounded-full px-2.5 py-1 font-semibold ${tones[tone]}`}>{children}</span>
}

function RowCard({
  row,
  chosen,
  skipped,
  onChoose,
  onSkip,
}: {
  row: ImportRow
  chosen?: string
  skipped: boolean
  onChoose: (line: number, drugId: string) => void
  onSkip: (line: number, v: boolean) => void
}) {
  const willSave = !skipped && (row.status === 'matched' || !!chosen)

  return (
    <div
      className={`rounded-xl border p-3 ${
        skipped
          ? 'border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-white/5'
          : willSave
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
            : 'border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
            {row.source.name || <span className="italic text-gray-400">(blank)</span>}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Line {row.line}
            {row.source.strength && ` · ${row.source.strength}`}
            {row.source.brand && ` · ${row.source.brand}`}
            {row.quantity !== null && ` · qty ${row.quantity}`}
            {!row.inStock && ' · marked out of stock'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-black/30 dark:text-gray-300">
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      {row.reason && (
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{row.reason}</p>
      )}

      {row.status === 'matched' && row.candidates[0] && (
        <p className="mt-1.5 text-sm text-emerald-800 dark:text-emerald-300">
          → {row.candidates[0].genericName} {row.candidates[0].strength} (
          {row.candidates[0].form.toLowerCase()})
        </p>
      )}

      {/* Offered, never pre-selected: the whole reason this row is here is
          that the machine could not tell, and a pre-ticked guess is the
          same guess with the blame moved. */}
      {row.status !== 'matched' && row.candidates.length > 0 && !skipped && (
        <div className="mt-2 space-y-1.5">
          {row.candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => onChoose(row.line, c.id)}
              className={`block w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-sm ${
                chosen === c.id
                  ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200'
                  : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {c.genericName} {c.strength} ({c.form.toLowerCase()})
            </button>
          ))}
        </div>
      )}

      {row.status !== 'invalid' && (
        <button
          onClick={() => onSkip(row.line, !skipped)}
          className="mt-2 cursor-pointer text-xs font-semibold text-gray-500 underline underline-offset-2 dark:text-gray-400"
        >
          {skipped ? 'Include this row' : 'Skip this row'}
        </button>
      )}
    </div>
  )
}
