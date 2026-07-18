/** Abstract brand graphic for the homepage hero — deliberately iconographic
 *  rather than stock photography (we don't have real product/people photos
 *  to use, and won't fabricate any). */
export default function HeroGraphic() {
  return (
    <svg viewBox="0 0 400 400" className="mx-auto w-full max-w-sm" role="img" aria-label="PharmaFinder illustration">
      <circle cx="190" cy="190" r="170" className="fill-emerald-50 dark:fill-emerald-500/10" />
      <circle cx="190" cy="190" r="170" className="fill-none stroke-emerald-200 dark:stroke-emerald-800" strokeWidth="1.5" />

      <g transform="translate(120 110)">
        <rect width="140" height="140" rx="38" className="fill-emerald-600 dark:fill-emerald-500" />
        <rect x="60" y="30" width="20" height="80" rx="6" fill="white" />
        <rect x="30" y="60" width="80" height="20" rx="6" fill="white" />
      </g>

      <clipPath id="pillClip">
        <circle cx="305" cy="300" r="82" />
      </clipPath>
      <g clipPath="url(#pillClip)">
        <circle cx="305" cy="300" r="82" className="fill-white dark:fill-gray-900" />
        <g transform="translate(305 300)">
          <g transform="rotate(-25) translate(-46 -14)">
            <rect width="92" height="28" rx="14" className="fill-emerald-500" />
            <rect width="46" height="28" rx="14" className="fill-emerald-800" />
          </g>
          <g transform="rotate(35) translate(-40 6)">
            <rect width="80" height="24" rx="12" className="fill-teal-400" />
            <rect width="40" height="24" rx="12" className="fill-emerald-600" />
          </g>
          <g transform="rotate(-70) translate(-34 34)">
            <rect width="68" height="20" rx="10" className="fill-emerald-300" />
            <rect width="34" height="20" rx="10" className="fill-emerald-600" />
          </g>
        </g>
      </g>
      <circle cx="305" cy="300" r="82" className="fill-none stroke-emerald-200 dark:stroke-emerald-800" strokeWidth="1.5" />
    </svg>
  )
}
