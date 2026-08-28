/**
 * Tailwind first, then two plugins that lower what it emits so the
 * stylesheet survives an old Safari.
 *
 * Tailwind v4's output needs Safari 16.4. On anything older the browser
 * does not degrade politely — it drops whole rules it cannot parse, and
 * because Tailwind wraps almost everything in `@layer`, an engine without
 * cascade layers throws the entire stylesheet away and the page arrives
 * unstyled. See BROWSERS.md.
 *
 * Order matters: both run after Tailwind has generated its CSS, and
 * cascade-layers has to see the layers before color-mix rewrites the
 * declarations inside them.
 *
 * `@csstools/postcss-cascade-layers` is production-only. Under `next dev`
 * (Turbopack) it breaks Tailwind v4's incremental output — only a
 * fraction of the utilities (notably every responsive `md:`/`lg:` rule)
 * ever reaches the browser, so the dev site renders as if every
 * breakpoint were its smallest. `next build` processes the stylesheet in
 * one pass and is unaffected. Dev only has to look right in a current
 * browser, which understands `@layer` natively, so dropping the flatten
 * step there costs nothing.
 */
const flattenLayersForOldSafari = process.env.NODE_ENV === "production";

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // `@layer` → plain rules with equivalent specificity (Safari 15.4).
    ...(flattenLayersForOldSafari
      ? { "@csstools/postcss-cascade-layers": {} }
      : {}),
    // `color-mix(...)` → a computed rgb() fallback alongside the original,
    // so a browser that understands it still gets the real thing (16.2).
    "@csstools/postcss-color-mix-function": { preserve: true },
  },
};

export default config;
