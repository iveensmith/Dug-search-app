import HeroFigure from '@/components/ui/HeroFigure'
import NetworkPulse from '@/components/NetworkPulse'

/**
 * The photograph beside the headline, and the live card that overlaps it.
 *
 * Set HERO_PHOTO to the file's path once it exists in `public/` — one
 * line, and the panel switches from the placeholder illustration to the
 * real thing with nothing else to change. It is a constant rather than a
 * filesystem check because a missing hero image should be a visible
 * decision in the source, not a silent fallback nobody notices for a
 * month.
 *
 * The live card lives here rather than beside the panel so each branch can
 * anchor it to something real. Against a photograph that fills the panel,
 * the panel's bottom-left corner is the photograph's bottom-left corner.
 * Against the centred stand-in illustration it is not, and a card pinned
 * to the panel floated in empty space well below the drawing.
 */
const HERO_PHOTO: string | null = null

const HERO_ALT = 'A man searching for his medicine on his phone'

export default function HeroPanel() {
  if (!HERO_PHOTO) {
    // Interim. The illustration keeps its arch rather than being stretched
    // to fill a panel it was not drawn for — this is a stand-in that
    // should look like a stand-in, not a broken photograph. No background
    // of its own, so the band shows through and the panel's edge does not
    // draw a seam down the page.
    return (
      <div className="flex h-full items-center justify-center overflow-hidden px-6 py-6">
        <div className="relative">
          <HeroFigure className="max-h-full" />
          <NetworkPulse showCounts={false} />
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/*
        The photo fades out on its left rather than sitting behind a
        matching gradient. A gradient would have to be told the band's
        colour and told again for dark mode, and would be a shade off in
        both; a mask makes the pixels transparent and lets whatever the
        band actually is show through.

        object-position favours the upper middle, which is where a standing
        figure's face is. Cropping from the centre puts the headline next
        to somebody's waist.
      */}
      <div className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_36%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          alt={HERO_ALT}
          className="h-full w-full object-cover object-[58%_22%]"
        />
        {/* The brand wash. Deeper in dark mode, where a bright photograph
            beside dark type is the one thing that breaks the page. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-emerald-800/25 dark:bg-emerald-950/60"
        />
      </div>

      {/* Outside the masked box, or the fade would eat the card too. */}
      <NetworkPulse showCounts={false} />
    </div>
  )
}
