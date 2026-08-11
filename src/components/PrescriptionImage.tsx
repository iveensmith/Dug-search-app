'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconX } from '@/components/ui/icons'

/**
 * The prescription photo, and a way to actually read it.
 *
 * In the thread the photo is capped at a few hundred pixels so the
 * conversation stays the thing on screen. That is right for context and
 * useless for the job: a prescription is handwriting, often faint, often
 * photographed at an angle, and the one question both sides of this
 * conversation have is "what does that say". The pharmacist is being
 * asked to give dosing advice from it.
 *
 * So the thumbnail opens a viewer, and the viewer has two states rather
 * than one. Fitted to the screen is where it opens — the whole slip, to
 * get your bearings. Tapping again goes to the image's own size, which on
 * a phone is several times the screen and scrolls, because that is what
 * it takes to read a scrawled strength. Pinch-zoom still works on top of
 * both; `touch-action` keeps the browser's own gesture rather than
 * replacing it with a worse hand-rolled one.
 */
export default function PrescriptionImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  const [actualSize, setActualSize] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setActualSize(false)
    // Back to the thumbnail that opened it, or a keyboard user is dropped
    // at the top of the document with their place lost.
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    // The page behind must not scroll under the overlay — on a phone that
    // is how you close a viewer, lose your place in the thread, and have
    // to find the message again.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, close])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} — open full size`}
        className="block w-full cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        {/* The width/height reserve its space so the conversation
            underneath doesn't jump down the page when the photo arrives. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          width={1600}
          height={1600}
          className="max-h-80 w-full rounded-lg object-contain"
        />
      </button>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tap the photo to see it full size</p>

      {open && (
        <div
          // Solid, not translucent: the thread showing through competes
          // with the one thing this screen exists to show, and a
          // prescription is being read for a dose.
          className="fixed inset-0 z-[1600] bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close the photo"
            // Both this and the hint below sit over the photo, and a
            // prescription is white paper — so they carry their own dark
            // backing rather than trusting the backdrop to be behind them.
            className="absolute right-3 top-3 z-10 cursor-pointer rounded-full bg-black/70 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <IconX width={20} height={20} />
          </button>

          {/* Clicking the space around the photo closes, the way every
              other viewer behaves. The photo itself toggles size, so the
              two never fight over the same tap — which means the <img>
              has to be the size of the picture and not of the screen.
              Sized to fill with object-contain it looks identical, but
              the letterboxed bars are still the image, and tapping them
              zooms when the person meant to dismiss.
              `m-auto` centres rather than `items-center`, which would put
              the overflow of a zoomed photo above the scroll origin and
              make the top of it unreachable. */}
          <div
            className="flex h-dvh w-full overflow-auto overscroll-contain p-2 [touch-action:pinch-zoom]"
            onClick={(e) => {
              if (e.target === e.currentTarget) close()
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={() => setActualSize((v) => !v)}
              className={
                actualSize
                  ? 'm-auto max-w-none cursor-zoom-out'
                  : 'm-auto max-h-full max-w-full cursor-zoom-in object-contain'
              }
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <p className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
              {actualSize ? 'Tap the photo to fit it to the screen' : 'Tap the photo to zoom in'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
