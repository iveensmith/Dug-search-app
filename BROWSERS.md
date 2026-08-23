# Which browsers MediQuest runs on

Written after an iPhone 6 report: "a lot of things were not working."

## The floor

**Safari 16.4+ / iOS 16.4+**, Chrome 111+, Firefox 128+.

That number is not a preference. It is what the two things this app is
built on require, and it was measured from the built output rather than
looked up.

## What the build actually ships

Counted in `.next/static/chunks` after `next build`:

| Feature | In the bundle | Needs |
|---|---|---|
| `@property` | 70 uses | Safari **16.4** |
| `color-mix()` | 181 uses | Safari **16.2** |
| `@layer` | 5 uses | Safari 15.4 |
| `dvh` units | 12 uses | Safari 15.4 |
| flex/grid `gap` | 16 uses | Safari 14.1 |
| `:where()` | 168 uses | Safari 14 |
| `??` (nullish) | 237 uses | Safari **13.1** |
| `?.` (optional chaining) | 166 uses | Safari **13.1** |
| `Object.hasOwn` | 7 uses | Safari 15.4 |

`@property` and `color-mix()` come from Tailwind v4 — they are how the
semantic token layer resolves. `??` and `?.` come from the app and its
dependencies through Next 16's default browser target, which does not
transpile them.

## What an old iPhone actually sees

Not a blank page, which is what makes it confusing.

Next server-renders even client components, so the HTML arrives and the
page *looks* right. Then the bundle fails to parse, React never hydrates,
and nothing responds: the state picker does nothing, the search button
does nothing, the theme toggle does nothing. Meanwhile Safari drops every
`@layer` block it cannot parse, so most of the styling is gone too.

| Device | Max iOS | Result |
|---|---|---|
| iPhone 6 / 6 Plus | 12.5.7 | Nothing works — fails the JS floor and the CSS floor |
| iPhone 6s / 7 / SE (1st gen) | 15.8 | Interactive, but `@property` and `color-mix()` fail, so colours and translucency break |
| iPhone 8 / X | 16.7 | Supported |
| iPhone XS and newer | 17+ | Supported |

Android is less exposed: Chrome updates independently of the OS, so even
an old handset usually has a current Chrome.

## What we do about it

`src/app/layout.tsx` runs `OLD_BROWSER_SCRIPT` in `<head>`. It
feature-detects both floors — `new Function('o?.a')` for the syntax, and
`CSS.supports('color', 'color-mix(...)')` for the stylesheet — and shows
a plain banner when either fails.

Three things about it are deliberate:

- **It is ES5.** No `const`, no arrow, no template literal. A browser that
  cannot parse the warning cannot be warned by it.
- **It is styled inline.** On these browsers the stylesheet is part of
  what is broken, so the banner cannot rely on it.
- **It attaches to `<html>`, not `<body>`.** Inserted at
  `DOMContentLoaded` it lands before React hydrates, and React treats an
  unexpected first child of `<body>` as a mismatch — it throws, rebuilds
  the tree, and the banner vanishes. That would have hit exactly the
  devices new enough to run React but too old for the stylesheet.

## Lowering the floor, if that ever matters

Raising reach past iPhone 8 is not a small change:

- **The JS half is cheap.** A `browserslist` entry targeting older Safari
  makes SWC transpile `??` and `?.`. Bundle grows; nothing else moves.
- **The CSS half is not.** `@property` and `color-mix()` are load-bearing
  in Tailwind v4 and cannot be polyfilled meaningfully. Supporting Safari
  below 16.4 means leaving Tailwind v4 — which means unwinding the whole
  semantic token layer.

Doing only the cheap half is worse than doing neither: the app would come
alive on a phone whose colours are broken, instead of saying plainly that
it will not work.

## Re-checking after a dependency bump

```bash
npx next build
# then count the features in .next/static/chunks/*.{css,js}
```

If the numbers above move, update this file and the banner's thresholds
together.
