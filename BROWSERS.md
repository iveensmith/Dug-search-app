# Which browsers MediQuest runs on

Written after an iPhone 6 report — "a lot of things were not working" —
and then rewritten, because the first answer was to warn those phones
away and the right answer was to make the app run on them.

## The floor

**iOS 12 / Safari 12**, Chrome 64+, Firefox 63+.

That is a real floor, not an aspiration: every JS chunk is verified to
parse as ES2018, and the stylesheet no longer depends on a feature that
makes an old Safari discard it.

## What was actually wrong

Two separate things, and only one of them was what it looked like.

**The bundle would not parse.** It shipped 237 `??` and 166 `?.`, which
Safari below 13.1 cannot read. A script that fails to parse does not run
at all, so React never hydrated and every control was dead — on a page
that Next had server-rendered and which therefore *looked* fine. That is
the worst failure mode there is: a working-looking page, in front of
someone trying to find medicine.

Fixed by setting `browserslist` in `package.json`, which is all it takes
to make SWC compile the app and its dependencies down. Cost: about 140 KB
more JS.

**The stylesheet would be discarded.** Tailwind v4 wraps almost
everything in `@layer`, and a browser that does not know cascade layers
throws away the whole block rather than degrading — so below Safari 15.4
the page arrived unstyled. Fixed with `@csstools/postcss-cascade-layers`,
which rewrites layers into plain rules with matching specificity (the
`:not(#\#)` selectors in the output are its doing). Cost: about 45 KB
more CSS.

## What was never wrong

`color-mix()` — and this matters, because the first version of the
browser warning tested for it and was therefore wrong.

Tailwind already wraps every `color-mix()` in `@supports` with a plain
fallback beside it. A browser without `color-mix` takes the fallback and
renders perfectly well. Testing for it flagged phones on which the app
worked, and showed them a red banner saying it would not — which is worse
than showing nothing at all. A screenshot from a real handset is what
exposed it: the page in the photo was rendering correctly, banner and
all.

The lesson worth keeping: a feature test is only as good as the link
between the feature and the thing that actually breaks.

## What still degrades, and how much

| Feature | Needs | Missing it costs |
|---|---|---|
| `color-mix()` | Safari 16.2 | Some translucent fills fall back to a flat colour |
| `@property` | Safari 16.4 | Some gradients and shadows lose their animation |
| `:where()` | Safari 14 | Dark-mode rules stop applying — light theme only |
| flex `gap` | Safari 14.1 | Spacing between some controls collapses |
| `dvh` | Safari 15.4 | Full-height sections fall back to `vh` |
| `text-wrap: balance` | Safari 17.4 | Headings wrap unevenly |

None of these stop the app working. `Object.hasOwn` and `Array.at()`,
which would have thrown at runtime, are polyfilled in the head script.

| Device | Max iOS | Result |
|---|---|---|
| iPhone 6 / 6 Plus | 12.5 | Runs; light theme only, some spacing collapses |
| iPhone 6s / 7 / SE (1st gen) | 15.8 | Runs; a few flat fills instead of translucent |
| iPhone 8 and newer | 16.7+ | Everything |

## The warning banner

`OLD_BROWSER_SCRIPT` in `src/app/layout.tsx` now shows a banner only when
the engine cannot parse ES2018 — that is, when the bundle genuinely will
not run. Missing colour functions do not earn one.

Three things about it are deliberate:

- **It is ES5.** No `const`, arrow, or template literal. A browser that
  cannot parse the warning cannot be warned by it. Checked by parsing the
  emitted script with acorn at `ecmaVersion: 5`.
- **It is styled inline.** If the stylesheet is the broken thing, the
  banner cannot rely on it.
- **It attaches to `<html>`, not `<body>`.** Inserted at
  `DOMContentLoaded` it lands before React hydrates, and React treats an
  unexpected first child of `<body>` as a mismatch — it throws, rebuilds
  the tree, and the banner vanishes.

## Measuring how much this actually costs

Admin → **Search gaps** → *Browsers, last 30 days* shows the split, as a
percentage and a count:

| Row | Bucket | Who |
|---|---|---|
| Cannot run at all | `js_too_old` | iPhone 6 and older |
| Runs, colours broken | `css_too_old` | iPhone 6s, 7, SE (1st gen) |
| Runs fully | `supported` | iPhone 8 and newer |

The head script posts one of those three words to
`POST /api/telemetry/browser`, once per session. That is the entire
payload — the table has no column for an address, a user agent, a session
or a user, so there is nothing to leak and nothing to correlate. For an
app whose visitors are looking up their own medicines, that limit is the
point, not an oversight.

`supported` is recorded alongside the failures on purpose: the decision
below turns on the proportion, and a count of failures with no
denominator cannot tell you whether it is 1% or 30%.

The endpoint has to be open — the browsers worth hearing from are the
ones that cannot sign in, and in the worst case cannot run React — so it
is built to be dull: three literal values accepted, a 64-byte body cap, a
bounded counter increment, 60 posts per IP per hour, and always 204 so a
prober learns nothing. The worst an abuser achieves is a wrong number in
the decision below.

## Going lower than iOS 12

Below Safari 12 the bundle would need compiling to ES5, which means
regenerator for async/await and a markedly larger download on connections
that are already the reason this app exists. Not worth it unless the
numbers above say otherwise.

## Re-checking after a dependency bump

```bash
npx next build
# then: node -e "…" to parse every chunk at ecmaVersion 2018
```

If the numbers above move, update this file and the banner's thresholds
together.
