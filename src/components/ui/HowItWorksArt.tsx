import { IconSearch, IconStore, IconShieldCheck, IconMapPin } from '@/components/ui/icons'

/**
 * Three small "screenshots" for the how-it-works cards — crafted from the
 * real design tokens rather than captured PNGs, so they stay sharp, theme
 * with the page, and weigh nothing. Each one shows the actual UI pattern
 * that step produces.
 */

const frame =
  'relative h-[132px] overflow-hidden rounded-field border border-line bg-canvas'

/** Step 1 — typing a drug name, with the autocomplete resolving a brand. */
export function SearchArt() {
  return (
    <div className={frame}>
      <div className="p-3.5">
        <div className="flex items-center gap-2 rounded-field border border-line bg-surface px-3 py-2 shadow-card">
          <IconSearch width={14} height={14} className="shrink-0 text-faint" />
          <span className="text-[0.8125rem] text-ink">
            panadol
            <span className="ml-px inline-block h-[1.1em] w-px translate-y-[0.15em] bg-brand" />
          </span>
        </div>
        <div className="mt-2 rounded-field border border-line-brand bg-surface p-2 shadow-raised">
          <p className="text-[0.8125rem] font-semibold text-ink">Paracetamol 500 mg</p>
          <p className="mt-0.5 text-[0.6875rem] text-faint">Panadol · Emzor Paracetamol</p>
        </div>
      </div>
    </div>
  )
}

/** Step 2 — two nearby pharmacies, nearest first, one carrying the rule. */
export function CompareArt() {
  const rows = [
    { name: 'Mercyland Pharmacy', km: '0.0', rule: true },
    { name: 'GraceCare Pharmacy', km: '0.8', rule: false },
  ]
  return (
    <div className={frame}>
      <div className="space-y-2 p-3.5">
        {rows.map((r) => (
          <div
            key={r.name}
            className={`flex items-center gap-2 rounded-field border border-line bg-surface px-2.5 py-2 shadow-card ${
              r.rule ? 'border-l-2 border-l-brand' : ''
            }`}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-brand-soft text-brand-ink">
              <IconStore width={12} height={12} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.75rem] font-semibold text-ink">{r.name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[0.625rem] text-ok-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                <span className="font-mono">in stock</span>
                <IconShieldCheck width={9} height={9} className="ml-0.5 text-ok" />
              </span>
            </span>
            <span className="shrink-0 font-mono text-[0.6875rem] font-medium tabular-nums text-faint">
              {r.km} km
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Step 3 — the route drawn in deep green from you to the pharmacy. */
export function RouteArt() {
  return (
    <div className={frame}>
      {/* An abstracted street grid so the route has somewhere to sit. */}
      <svg viewBox="0 0 260 132" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <g className="stroke-line" strokeWidth="6" fill="none" opacity="0.7">
          <path d="M-10 34 H270" />
          <path d="M-10 92 H270" />
          <path d="M70 -10 V142" />
          <path d="M180 -10 V142" />
        </g>
        {/* white casing + deep-green route, the same treatment as the map */}
        <path
          d="M40 104 C 90 104, 70 60, 128 58 S 200 40, 214 22"
          fill="none"
          stroke="#ffffff"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M40 104 C 90 104, 70 60, 128 58 S 200 40, 214 22"
          fill="none"
          stroke="#0a5744"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        {/* start: your location */}
        <circle cx="40" cy="104" r="7" fill="#ffffff" />
        <circle cx="40" cy="104" r="4.5" fill="#2563eb" />
      </svg>
      {/* end: the pharmacy pin */}
      <span className="absolute right-[13%] top-[6px] text-brand-ink">
        <IconMapPin width={20} height={20} className="drop-shadow-sm" />
      </span>
      <span className="absolute bottom-2.5 left-3 rounded bg-surface px-1.5 py-0.5 font-mono text-[0.625rem] font-medium text-ink shadow-card">
        12 min drive
      </span>
    </div>
  )
}

export const HOW_IT_WORKS_ART = [SearchArt, CompareArt, RouteArt] as const
