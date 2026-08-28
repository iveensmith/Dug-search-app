import Image from 'next/image'
import heroPhoto from '../../../public/hero.jpg'
import NetworkPulse from '@/components/NetworkPulse'

/**
 * The photograph beside the headline, and the live card that overlaps it.
 *
 * Photo: Emmanuel Ikwuegbu, via Unsplash (unsplash.com/photos/81fRHbVliQI).
 * The Unsplash licence does not require the credit; it is here so nobody
 * later has to work out where the file came from before reusing it.
 *
 * The picture is art-directed rather than dropped in: a graded wash pulls
 * the shadows toward ink and the midtones toward the brand green, a fine
 * grain sits over it so it reads as a printed plate, and it fades on its
 * left edge into the page. The live "heartbeat" card overlaps its lower
 * corner — the one animated thing on the screen, saying a real pharmacy
 * confirmed real stock a few minutes ago.
 */

const HERO_ALT = 'A man smiling at his phone while looking something up'

export default function HeroPanel() {
  return (
    <div className="relative h-full w-full">
      {/* The picture's own box: the whole band on a phone, and from `md`
          the right ~56% of it, with a hairline marking where it starts. */}
      <div className="grain absolute inset-y-0 right-0 w-full overflow-hidden md:left-auto md:w-[56%] md:border-l md:border-line">
        <div className="absolute inset-0 overflow-hidden md:[mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.4)_9%,black_36%)]">
          <Image
            src={heroPhoto}
            alt={HERO_ALT}
            fill
            sizes="(min-width: 768px) 56vw, 100vw"
            placeholder="blur"
            priority
            className="scale-[1.03] object-cover object-[54%_26%] contrast-[1.04] saturate-[0.82] md:object-[46%_18%]"
          />

          {/*
            The grade, in layers.

            On a phone the picture is the whole band's background and the
            headline sits on it, so the first wash is a heavy near-black
            scrim carrying the type — measured to hold white text over the
            brightest pixel behind the copy at better than AA.

            From `md` the copy moves off the picture. The scrim drops to a
            light ink veil for depth, a green multiply pulls the concrete
            into the palette, and a gradient from the left seats the photo
            against the page instead of butting it up against the copy.
          */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-ink-950/64 md:bg-ink-950/20"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden mix-blend-multiply md:block md:bg-brand-900/22"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden md:block md:bg-gradient-to-l md:from-canvas/0 md:via-canvas/0 md:to-canvas/70"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden md:block md:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_-80px_120px_-60px_rgb(6_52_42/0.5)]"
          />
        </div>

        {/* Outside the masked box so the dissolve doesn't eat the card,
            and over the picture's lower-right corner. Desktop only — on a
            phone the picture is the whole band and has no corner, so
            PatientHome renders an inline one under the search panel. */}
        <div className="hidden md:block">
          <NetworkPulse showCounts={false} />
        </div>
      </div>
    </div>
  )
}
