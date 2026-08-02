'use client'

import { useState } from 'react'
import { IconShieldCheck } from '@/components/ui/icons'

/**
 * One-line summary by default with the full terms a tap away — the whole
 * paragraph between the heading and the upload control was pushing the
 * primary action off the first screen. `variant="full"` renders it expanded
 * for the spot under the send button, where there's room for the detail.
 */
export default function PrescriptionDisclaimer({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const [open, setOpen] = useState(variant === 'full')

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
      <div className="flex items-start gap-2.5">
        <IconShieldCheck width={16} height={16} className="mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
        <p className="min-w-0 font-semibold">
          Pharmacists here explain your prescription — they can&apos;t change or issue one.
          {variant === 'compact' && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="cursor-pointer font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300"
                aria-expanded={open}
              >
                {open ? 'Show less' : 'Read more'}
              </button>
            </>
          )}
        </p>
      </div>
      {open && (
        <p className="mt-2 pl-[26px] font-normal">
          The pharmacist explains what is written on it. They cannot change your prescription, adjust
          your dose, or issue a new one, and this chat does not replace your doctor or an in-person
          pharmacist consultation. For dosing decisions, always follow your prescriber. If you feel
          seriously unwell, seek medical care immediately.
        </p>
      )}
    </div>
  )
}
