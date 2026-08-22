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
 * `next/image` rather than a bare <img>: it emits a srcset and serves
 * AVIF/WebP where the browser takes them, which on the connection a lot of
 * these patients are on is the difference between the hero arriving and
 * the hero arriving eventually. The static import carries the intrinsic
 * size, so `placeholder="blur"` costs nothing extra and the panel is
 * never a blank rectangle while the file lands.
 *
 * The live card lives here rather than beside the panel so it can anchor
 * to the photograph's own bottom-left corner.
 */

const HERO_ALT = 'A man smiling at his phone while looking something up'

export default function HeroPanel() {
  return (
    <div className="relative h-full w-full">
      {/*
        The photo fades out on its left rather than sitting behind a
        matching gradient. A gradient would have to be told the band's
        colour and told again for dark mode, and would be a shade off in
        both; a mask makes the pixels themselves transparent and lets
        whatever the band actually is show through.

        object-position favours the upper middle. He is standing, so his
        face is in the top third and the phone is at the centre — cropping
        from the middle of the frame would put the headline next to a pair
        of trousers.
      */}
      <div className="absolute inset-0 overflow-hidden md:[mask-image:linear-gradient(to_right,transparent_0%,black_36%)]">
        <Image
          src={heroPhoto}
          alt={HERO_ALT}
          fill
          // Half the viewport once the layout splits, the whole of it
          // while the picture is still a banner under the search box.
          sizes="(min-width: 768px) 50vw, 100vw"
          placeholder="blur"
          priority
          // Two crops, because the frame changes shape. Tall beside the
          // copy, the whole height fits and only the sides are trimmed.
          // As a wide banner on a phone it is the height that gets cut, so
          // the anchor moves up to keep his head and the phone in frame
          // rather than centring on his chest.
          className="object-cover object-[54%_8%] md:object-[54%_28%]"
        />
        {/* The brand wash, which is what makes a grey concrete wall belong
            to this page. Deeper in dark mode, where a bright photograph
            beside dark type is the one thing that breaks the layout. */}
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
