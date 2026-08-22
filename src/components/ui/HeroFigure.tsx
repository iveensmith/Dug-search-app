/**
 * The person at the top of the home page.
 *
 * The design this follows puts a photograph of somebody in an arched frame
 * beside the headline, with a small live card overlapping its lower corner.
 * We have no photograph — we don't have one licensed, and inventing a
 * patient is exactly the kind of thing a health site should not do — so
 * this is an illustration in the brand palette: a man holding a phone,
 * mid-search, with a result list on the screen.
 *
 * It is drawn *into the frame the photo would use*, not instead of it.
 * Pass `src` and a real photograph takes the same arch, the same crop and
 * the same floating card with no other change:
 *
 *   <HeroFigure src="/hero.jpg" alt="…" />
 *
 * Skin, hair and the phone are literal colours rather than theme classes:
 * they stand in for a photograph, and a photograph does not repaint itself
 * in dark mode. Only the frame and its backdrop follow the theme.
 */

const SKIN = '#8a5a3b'
const SKIN_LIGHT = '#9c6845'
const SKIN_SHADE = '#6f4529'
const HAIR = '#241812'
const SHIRT = '#047857'
const SHIRT_DARK = '#065f46'
const PHONE = '#111827'

// Rounded top, softened bottom corners — the arch the reference frames its
// photograph in.
const ARCH =
  'M20 240 A200 200 0 0 1 420 240 V468 A32 32 0 0 1 388 500 H52 A32 32 0 0 1 20 468 Z'

type Props = {
  /** A real photograph, if one ever exists. Cropped to fill the arch. */
  src?: string
  alt?: string
  className?: string
}

export default function HeroFigure({ src, alt, className = '' }: Props) {
  const label = alt ?? 'A man searching for his medicine on his phone'

  return (
    // The width caps are smaller on a phone than the frame would like:
    // this is a portrait in a tall arch, and at full width it ate the
    // screen the search box needs to be on.
    <svg
      viewBox="0 0 440 520"
      className={`w-full max-w-[15rem] sm:max-w-[19rem] md:max-w-[26rem] ${className}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id="mq-hero-arch">
          <path d={ARCH} />
        </clipPath>
      </defs>

      {/* The field the frame sits on, one step deeper than the band behind
          it so the arch has an edge without needing a border. */}
      <path d={ARCH} className="fill-emerald-100 dark:fill-emerald-950" />

      <g clipPath="url(#mq-hero-arch)">
        {src ? (
          <image
            href={src}
            x="20"
            y="40"
            width="400"
            height="460"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <>
            {/* A deeper wash under the figure — the same trick a studio
                backdrop plays, keeping the head against the lighter half. */}
            <circle cx="220" cy="452" r="210" className="fill-emerald-200/70 dark:fill-emerald-900/50" />

            {/* Two quiet props in the empty upper corners: a capsule and a
                magnifier, the two things the app is about. */}
            <g className="fill-none stroke-white/50 dark:stroke-white/15" strokeWidth="5">
              <circle cx="86" cy="152" r="21" />
              <path d="M101 167 L116 182" strokeLinecap="round" />
            </g>
            <g transform="rotate(-24 350 150)">
              <rect x="322" y="138" width="60" height="26" rx="13" className="fill-white/55 dark:fill-white/12" />
              <path d="M352 138 v26" className="stroke-emerald-600/40 dark:stroke-white/20" strokeWidth="4" />
            </g>

            {/* Torso first, so the neck and jaw sit on top of the collar. */}
            <path d="M56 500 C56 398 124 344 215 344 C306 344 374 398 374 500 Z" fill={SHIRT} />
            <path d="M182 346 L215 400 L248 346 L232 342 L215 372 L198 342 Z" fill={SHIRT_DARK} />

            <rect x="193" y="286" width="44" height="66" rx="18" fill={SKIN_SHADE} />

            {/* Hair sits behind the face and again across the forehead, so
                the hairline reads as a hairline rather than a hat brim. */}
            <ellipse cx="215" cy="206" rx="81" ry="76" fill={HAIR} />
            <ellipse cx="155" cy="246" rx="11" ry="15" fill={SKIN} />
            <ellipse cx="275" cy="246" rx="11" ry="15" fill={SKIN} />
            <ellipse cx="215" cy="236" rx="62" ry="72" fill={SKIN} />
            <path
              d="M153 234 C153 177 180 150 215 150 C250 150 277 177 277 234 C266 193 244 179 215 179 C186 179 164 193 153 234 Z"
              fill={HAIR}
            />

            {/* Eyes as downward arcs — she is reading the screen, and open
                staring eyes on an illustrated face land somewhere between
                cheerful and unsettling. */}
            <g fill="none" stroke={HAIR} strokeWidth="4.5" strokeLinecap="round">
              <path d="M186 246 q11 -10 22 0" />
              <path d="M226 246 q11 -10 22 0" />
              <path d="M182 226 q12 -7 24 -1" strokeWidth="4" />
              <path d="M226 225 q12 -6 24 1" strokeWidth="4" />
            </g>
            <path
              d="M214 250 q5 12 -4 15"
              fill="none"
              stroke={SKIN_SHADE}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M201 279 q14 12 28 -2"
              fill="none"
              stroke="#5a2f1e"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Forearm behind the phone, hand and thumb in front of it —
                which is the whole difference between holding something and
                standing next to it. */}
            <path
              d="M374 512 L340 448"
              stroke={SKIN}
              strokeWidth="44"
              strokeLinecap="round"
              fill="none"
            />

            <g transform="rotate(-12 316 372)">
              <rect x="276" y="294" width="80" height="156" rx="16" fill={PHONE} />
              <rect x="284" y="303" width="64" height="138" rx="9" fill="#ecfdf5" />

              {/* What she is doing, at the size it can still be read: a
                  search field and the list it returns. */}
              <rect x="292" y="315" width="48" height="18" rx="9" fill="#059669" />
              <g fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                <circle cx="301" cy="324" r="4.5" />
                <path d="M304.5 327.5 L308 331" />
              </g>
              <rect x="292" y="344" width="48" height="16" rx="8" fill="#ffffff" />
              <rect x="292" y="366" width="48" height="16" rx="8" fill="#ffffff" />
              <rect x="292" y="388" width="36" height="16" rx="8" fill="#ffffff" />
              <g fill="#34d399">
                <circle cx="299" cy="352" r="3" />
                <circle cx="299" cy="374" r="3" />
                <circle cx="299" cy="396" r="3" />
              </g>

              <ellipse cx="340" cy="446" rx="29" ry="25" fill={SKIN} />
              <rect
                x="309"
                y="392"
                width="18"
                height="56"
                rx="9"
                fill={SKIN_LIGHT}
                transform="rotate(20 318 420)"
              />
            </g>
          </>
        )}
      </g>
    </svg>
  )
}
