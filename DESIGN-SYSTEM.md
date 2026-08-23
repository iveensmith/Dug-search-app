# MediQuest 2.0 — Design System (code)

The token layer from the [Figma file](https://www.figma.com/design/FYLSH4FyhDcmbHLB44EsHJ), expressed as Tailwind v4 theme variables. Verified against `tailwindcss@4.3.3` — every utility below compiles.

## What's in this drop

| File | Goes to | Type of change |
|---|---|---|
| `globals.css` | `src/app/globals.css` | Full replacement. Every v1 rule preserved. |
| `Button.tsx` | `src/components/ui/Button.tsx` | Restyle. Prop API unchanged. |
| `Card.tsx` | `src/components/ui/Card.tsx` | Restyle + one **new optional** prop. |
| `Badge.tsx` | `src/components/ui/Badge.tsx` | Restyle. `BadgeTone` union unchanged. |
| `Field.tsx` | `src/components/ui/Field.tsx` | Restyle + one **new optional** prop. |

No new dependencies. No config file — you're on Tailwind v4 CSS-first, so `@theme` in `globals.css` *is* the config.

Nothing was removed. `buttonClass()`, `controlClass`, `labelClass`, `Input`, `Select`, `Textarea`, `Field`, every variant/size/accent/shape value, and the `loading` prop all keep their exact signatures, so the other 79 `.tsx` files compile untouched.

## Three decisions you should overrule if you disagree

**1. Body text hue changed.** `--foreground` was `#0f172a` — Tailwind's slate, which leans blue. Against emerald that reads slightly cold. It's now `#161d1a`, a neutral carrying a trace of the brand hue. One-line revert: set `--ink: #0f172a` in `:root`.

**2. Figma says Inter, your app says Open Sans.** I built the Figma file in Inter before reading the repo. Your comment in `globals.css` about slow Nigerian connections and the Segoe UI / Roboto fallback chain is a better argument than anything I'd make for switching, so **the code keeps Open Sans** and I'd leave it. The type scale is family-agnostic — sizes, line heights and tracking work either way. If you want them to match, change the Figma file, not the app.

**3. `md` buttons grew from ~38px to 44px.** WCAG 2.2 target-size minimum. It's a real visual change on dense screens like the pharmacy inventory table — check those before shipping.

## Token reference

Every semantic token generates `bg-*`, `text-*`, `border-*` and `ring-*` in one namespace.

### Surfaces
`bg-canvas` page · `bg-surface` cards · `bg-raised` popovers · `bg-sunken` wells, skeletons, disabled · `bg-inverse` tooltips

### Text
`text-ink` primary · `text-muted` secondary · `text-faint` tertiary · `text-on-brand` on brand fills · `text-brand-ink` brand-coloured text

### Brand
`bg-brand` · `bg-brand-hover` · `bg-brand-press` · `bg-brand-soft` · `bg-brand-deep`

`bg-brand-deep` is the surface counterpart of the `deep` button accent — emerald-700 light, emerald-800 dark — for a panel that should read as a deeper green than the ordinary brand fill. It pairs with `text-on-brand-deep`, which stays white in both themes because emerald-800 is dark enough that the near-black `--on-brand` fails against it.

Light resolves to emerald-700 with white text; dark to emerald-500 with near-black text. **The token already handles the swap — don't add a `dark:` class next to it.**

### Lines
`border-line-soft` hairlines · `border-line` default · `border-line-strong` hover · `border-line-brand` brand hover hint · `ring-focus` focus

### Status
Each tone has a solid, a soft fill, and a readable ink: `ok` · `warn` · `urgent` · `danger` · `info`

```
bg-ok-soft text-ok-ink        →  "In stock"
bg-warn-soft text-warn-ink    →  "Last confirmed 3 days ago"
bg-urgent-soft text-urgent-ink →  "Last few left"
bg-danger-soft text-danger-ink →  "Out of stock"
bg-info-soft text-info-ink    →  "Pending approval"
```

### Radius & elevation
`rounded-field` 14 · `rounded-control` 16 · `rounded-card` 20 · `rounded-sheet` 28

`shadow-card` · `shadow-raised` · `shadow-sheet` · `shadow-modal` · `shadow-brand`

### Type
`text-display` `text-h1` `text-h2` `text-h3` `text-title-lg` `text-title` `text-body-lg` `text-body` `text-caption` `text-label`

Each carries size, line-height, tracking and weight in one class. Tailwind's `text-sm` / `text-base` are untouched, so existing class lists still work.

### Primitives
`brand-50…950` and `ink-50…950` are available (`bg-brand-700`, `border-ink-200`) but reach for a semantic token first — primitives don't theme.

## Migrating the other components

Find-and-replace, roughly in this order. Every line on the right also deletes the `dark:` twin that used to sit beside it.

| Replace | With |
|---|---|
| `bg-white` / `dark:bg-gray-900` | `bg-surface` |
| `bg-gray-50` / `dark:bg-gray-950` | `bg-canvas` |
| `bg-gray-100` / `dark:bg-white/10` | `bg-sunken` |
| `text-gray-900` / `dark:text-gray-100` | `text-ink` |
| `text-gray-600` / `dark:text-gray-300` | `text-muted` |
| `text-gray-400`,`text-gray-500` / `dark:text-gray-500` | `text-faint` |
| `border-gray-200` / `dark:border-gray-800` | `border-line` |
| `border-gray-300` / `dark:border-gray-700` | `border-line-strong` |
| `bg-emerald-700` + `dark:bg-emerald-500` | `bg-brand` |
| `text-white` + `dark:text-emerald-950` | `text-on-brand` |
| `bg-emerald-50` / `dark:bg-emerald-500/15` | `bg-brand-soft` |
| `text-emerald-700` / `dark:text-emerald-400` | `text-brand-ink` |
| `bg-emerald-100 text-emerald-800` | `bg-ok-soft text-ok-ink` |
| `bg-amber-100 text-amber-800` | `bg-warn-soft text-warn-ink` |
| `bg-orange-50 text-orange-800` | `bg-urgent-soft text-urgent-ink` |
| `bg-red-100 text-red-700` | `bg-danger-soft text-danger-ink` |
| `bg-blue-100 text-blue-800` | `bg-info-soft text-info-ink` |
| `rounded-xl` on controls | `rounded-control` |
| `rounded-2xl` on cards | `rounded-card` |
| `rounded-3xl` on bands | `rounded-sheet` |
| `hover:border-emerald-200`,`hover:border-emerald-300` / `dark:hover:border-emerald-700`,`dark:hover:border-emerald-800` | `hover:border-line-brand` |
| `focus-visible:ring-emerald-500` | `focus-visible:ring-focus` |
| `divide-gray-100` / `dark:divide-gray-800` | `divide-line` |
| `placeholder:text-gray-400` / `dark:placeholder:text-gray-500` | `placeholder:text-faint` |
| `focus:border-emerald-500` / `dark:focus:border-emerald-400` | `focus:border-focus` |
| `focus:ring-emerald-200` / `dark:focus:ring-emerald-900` | `focus:ring-brand-soft` |
| `hover:bg-gray-50`,`hover:bg-gray-100` / `dark:hover:bg-white/5`,`dark:hover:bg-white/10` | `hover:bg-sunken` |
| `hover:text-gray-700`,`hover:text-gray-900` / `dark:hover:text-gray-200` | `hover:text-ink` |
| `hover:bg-emerald-800` on a brand fill | `hover:bg-brand-hover` |
| `bg-emerald-800` + `dark:bg-emerald-700` (owner surfaces) | `bg-brand-deep` |
| `text-white` + `dark:text-white` on a deep-brand fill | `text-on-brand-deep` |
| `text-blue-800`,`text-blue-900` / `dark:text-blue-200`,`dark:text-blue-300` | `text-info-ink` |
| `text-blue-500` / `dark:text-blue-400` (icon on info-soft) | `text-info` |
| `border-emerald-200` / `dark:border-emerald-900/60` around a `bg-brand-soft` callout | `border-line-brand` |
| `fill-emerald-600` / `dark:fill-emerald-500` | `fill-brand` |

Highest-value files first: `SearchBox`, `CoverageResults`, `ResultFilters`, `StockLevelBadge`, `OpenStatusBadge`, `DispensingBadge`, `PatientHome`, `SiteHeader`, `TabBar`.

### Two traps

**A `dark:` left beside a token silently wins.** The token resolves per theme
already, so the leftover `dark:` overrides it in dark mode and the token does
nothing. Replace each utility and its twin together — this is the failure mode
worth scanning for after every file.

**Variants change who wins, and authoring order is not emission order.**
Tailwind emits `hover:*` before `dark:*` and `dark:*` before `dark:hover:*`.
So on an element whose base colour has to stay raw — a gradient, an alpha
wash, anything sitting on a photograph — a bare `hover:<token>` is dead in
dark mode, because the raw `dark:` base is emitted after it. Those elements
need an explicit `dark:hover:<token>` twin. There is exactly one in the app
(the prescriptions CTA card on the home page) and it carries a comment saying
so, because it otherwise looks like the leftover the rule above warns about.

### What deliberately stays raw

Not everything has a token, and forcing one is worse than leaving the utility.
These are intentional, and each carries a comment where it lives:

- **Anything over the hero photograph** (`PatientHome` headline, `NetworkStatsRow`,
  `HeroPanel`'s scrim). White in both themes, because the photo is dark in both;
  `--ink` and `--on-brand` both flip. Only the `md:` halves, which land on mint,
  are tokens.
- **The "PCN verified" chip on a map** — map tiles are light in both themes.
- **The owner CTA's primary button** (`bg-white`) — `--surface` goes near-black in
  dark, which would make the primary quieter than the outlined link beside it.
- **Gradients and alpha washes** — three-stop backgrounds, translucent headers,
  the black lightbox scrim. A flat token loses the effect.
- **Mint page bands** (`bg-emerald-50` / `dark:bg-emerald-950/25`) — a band is a
  page-level wash, not a surface.
- **Rating gold** (`bg-amber-400`, `text-amber-500`) — stars are not a warning.

## Loading states

`globals.css` adds a `.skeleton` class — a token-aware shimmer that respects `prefers-reduced-motion` via the existing block at the bottom of the file.

```tsx
<div className="skeleton h-5 w-40" />
<div className="skeleton mt-2 h-4 w-full" />
```

Use it for the pharmacy-results list while a search is in flight. A skeleton shaped like the result card it precedes reads as "loading"; a spinner reads as "wait".

## Accessibility

Measured, not asserted. Light / dark:

| Pair | Light | Dark |
|---|---|---|
| `text-ink` on `bg-surface` | 17.2:1 AAA | 15.8:1 AAA |
| `text-muted` on `bg-surface` | 6.9:1 AA | 8.2:1 AAA |
| `text-faint` on `bg-surface` | 5.3:1 AA | 5.1:1 AA |
| `text-on-brand` on `bg-brand` | 5.5:1 AA | 6.0:1 AA |
| `text-brand-ink` on `bg-brand-soft` | 5.2:1 AA | 7.9:1 AAA |
| `text-warn-ink` on `bg-warn-soft` | 4.8:1 AA | 9.4:1 AAA |
| `text-danger-ink` on `bg-danger-soft` | 5.9:1 AA | 9.1:1 AAA |
| `text-info-ink` on `bg-info-soft` | 6.2:1 AA | 9.0:1 AAA |

Every text pair clears AA. `text-faint` was originally `#6b7b75` at 4.45:1 and was darkened to `#5f6f68` to clear the bar on `bg-sunken` too.

Also: a global `:focus-visible` outline on every interactive element, `min-h-11` (44px) on `md` buttons and `min-h-12` (48px) on form controls, `text-base` retained on inputs so iOS Safari doesn't zoom on focus, and `aria-busy` on loading buttons.

## Verify before committing

```bash
npm run dev
```

Then check, in order: the home hero and search, a results list in both themes, the `deep` accent on `/login?portal=pharmacy`, and the pharmacy inventory table for the 44px button change.

The one thing worth watching: if a component sets `bg-emerald-700 dark:bg-emerald-500` and you replace only the light half with `bg-brand`, the leftover `dark:` class wins in dark mode and the token is overridden. Delete both halves together.
