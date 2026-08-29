import Image from 'next/image'
import heroPhoto from '../../../public/hero.jpg'
import NetworkPulse from '@/components/NetworkPulse'

/**
 * The photograph beside the headline, and the live card that overlaps it.
 *
 * Image: generated, then art-directed here rather than dropped in — a
 * graded wash pulls the shadows toward ink and the midtones toward the
 * brand green, a fine grain sits over it so it reads as a printed plate,
 * and it fades on its left edge into the page. The live "heartbeat" card
 * overlaps its lower corner — the one animated thing on the screen, saying
 * a real pharmacy confirmed real stock a few minutes ago.
 *
 * The frame: a pharmacist handing a box of medicine and a paper bag across
 * the counter to a customer who is taking it with both hands. The subjects
 * sit right-of-centre and the left of the frame is a plain wall, which is
 * why the picture can dissolve into the copy on that side without cutting
 * anyone off.
 */

const HERO_ALT =
  'A pharmacist handing a box of medicine across the counter to a customer, who takes it with both hands'

export default function HeroPanel() {
  return (
    <div className="relative h-full w-full">
      {/* The picture's own box: the whole band on a phone, and from `md`
          the right ~60% of it. No edge or rule — it has to dissolve into
          the copy, not sit beside it. */}
      <div className="grain absolute inset-y-0 right-0 w-full overflow-hidden md:left-auto md:w-[60%]">
        {/* A long, gradual left-edge dissolve — the fade runs across most
            of the box's width so there is no line where photo meets page,
            just picture thinning into paper. */}
        <div className="absolute inset-0 overflow-hidden md:[mask-image:linear-gradient(to_right,transparent_0%,transparent_5%,rgba(0,0,0,0.15)_22%,rgba(0,0,0,0.6)_45%,black_68%)]">
          <Image
            src={heroPhoto}
            alt={HERO_ALT}
            fill
            sizes="(min-width: 768px) 60vw, 100vw"
            quality={92}
            placeholder="blur"
            priority
            className="parallax-hero object-cover object-[64%_46%] contrast-[1.03] saturate-[0.9] md:object-[72%_72%]"
          />

          {/*
            The grade, in layers.

            On a phone the picture is the whole band's background and the
            headline sits on it, so the first wash is a heavy near-black
            scrim carrying the type — measured to hold white text over the
            brightest pixel behind the copy at better than AA.

            From `md` the copy moves off the picture. The scrim drops to a
            light ink veil for depth and a green multiply pulls the frame
            into the palette.
          */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-ink-950/64 md:bg-ink-950/16"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden mix-blend-multiply md:block md:bg-brand-900/16"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden md:block md:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_-80px_120px_-60px_rgb(6_52_42/0.5)]"
          />
        </div>

        {/* The blend, finished in the page's own colour. The mask thins the
            photo out; this many-stop canvas gradient — theme-aware, sitting
            over the thinned edge — carries those last partial pixels the
            rest of the way to the exact page colour so there is no edge in
            either theme. Enough stops that it reads as falloff, not a band. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden md:block md:[background:linear-gradient(to_right,var(--color-canvas)_0%,color-mix(in_srgb,var(--color-canvas)_88%,transparent)_16%,color-mix(in_srgb,var(--color-canvas)_55%,transparent)_32%,color-mix(in_srgb,var(--color-canvas)_22%,transparent)_46%,transparent_60%)]"
        />

        {/* Over the picture's lower-right corner. Desktop only — on a phone
            the picture is the whole band and has no corner, so PatientHome
            renders an inline one under the search panel. */}
        <div className="hidden md:block">
          <NetworkPulse showCounts={false} />
        </div>
      </div>
    </div>
  )
}
