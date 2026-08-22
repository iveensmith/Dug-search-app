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
        The picture's own box: the whole band on a phone, and from `md` the
        right two thirds of it — wider than the copy column leaves room
        for, deliberately, so the photograph runs on behind the text and
        dissolves rather than stopping at a column edge. It was a panel
        butted up against the copy before, which read as two things side by
        side instead of one photograph the page is sitting on.
      */}
      <div className="absolute inset-y-0 right-0 w-full md:w-[66%]">
        {/*
          It fades out on its left rather than sitting behind a matching
          gradient. A gradient would have to be told the band's colour and
          told again for dark mode, and would be a shade off in both; a
          mask makes the pixels themselves transparent and lets whatever
          the band actually is show through.

          The fade is long and starts late, and both are measured rather
          than chosen. The copy column runs to about 26% into this box, and
          the body text there is grey on mint: with a 45% fade the picture
          was still 58% opaque under the lede and dropped it to 3.28:1,
          under AA. Holding it transparent for the first fifth and not
          reaching full until three quarters across leaves roughly a tenth
          of the picture behind the text — enough that it reads as one
          photograph the page is sitting on, little enough that the type
          stays legible. See scrim-contrast.mjs.
        */}
        <div className="absolute inset-0 overflow-hidden md:[mask-image:linear-gradient(to_right,transparent_0%,transparent_20%,black_75%)]">
          <Image
            src={heroPhoto}
            alt={HERO_ALT}
            fill
            sizes="(min-width: 768px) 66vw, 100vw"
            placeholder="blur"
            priority
            // He is standing, so his face is in the top third. Anchoring
            // near the top keeps his head and the phone in shot; centring
            // the frame would put the headline beside a pair of trousers.
            className="object-cover object-[52%_35%] md:object-[50%_18%]"
          />
          {/*
            Two different jobs for the same overlay.

            On a phone the picture is the whole band's background and the
            headline sits on it, so this is a scrim and it has to carry the
            type. 65% of emerald-950 is about the lightest it can be and
            still clear AA against white — measured on the rendered page,
            by sampling the brightest pixel behind the copy, rather than
            reasoned about. A photograph's local contrast varies across the
            frame in a way a flat background never does, so the number that
            matters is the worst pixel, not the average.

            From `md` the copy moves off the picture onto mint and this
            goes back to being a brand wash: enough to make a grey concrete
            wall belong to this page, not enough to hide anybody's face.
          */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-emerald-950/65 md:bg-emerald-800/25 md:dark:bg-emerald-950/60"
          />
        </div>

        {/* Outside the masked box, or the fade would eat the card too, and
            over the picture's right side rather than its left: the left is
            now the part that dissolves behind the copy, and a card there
            would land on the search panel. Desktop only — on a phone the
            picture is the whole band and has no corner to hang a card off,
            so PatientHome renders an inline one under the search panel. */}
        <div className="hidden md:block">
          <NetworkPulse showCounts={false} />
        </div>
      </div>
    </div>
  )
}
