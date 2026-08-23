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
`bg-brand` · `bg-brand-hover` · `bg-brand-press` · `bg-brand-soft`

Light resolves to emerald-700 with white text; dark to emerald-500 with near-black text. **The token already handles the swap — don't add a `dark:` class next to it.**

### Lines
`border-line-soft` hairlines · `border-line` default · `border-line-strong` hover · `ring-focus` focus

### Status
Each tone has a solid, a soft fill, and a readable ink: `ok` · `warn` · `danger` · `info`

```
bg-ok-soft text-ok-ink        →  "In stock"
bg-warn-soft text-warn-ink    →  "Last confirmed 3 days ago"
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
| `bg-red-100 text-red-700` | `bg-danger-soft text-danger-ink` |
| `bg-blue-100 text-blue-800` | `bg-info-soft text-info-ink` |
| `rounded-xl` on controls | `rounded-control` |
| `rounded-2xl` on cards | `rounded-card` |
| `rounded-3xl` on bands | `rounded-sheet` |
| `focus-visible:ring-emerald-500` | `focus-visible:ring-focus` |

Highest-value files first: `SearchBox`, `CoverageResults`, `ResultFilters`, `StockLevelBadge`, `OpenStatusBadge`, `DispensingBadge`, `PatientHome`, `SiteHeader`, `TabBar`.

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
