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
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // `@layer` → plain rules with equivalent specificity (Safari 15.4).
    "@csstools/postcss-cascade-layers": {},
    // `color-mix(...)` → a computed rgb() fallback alongside the original,
    // so a browser that understands it still gets the real thing (16.2).
    "@csstools/postcss-color-mix-function": { preserve: true },
  },
};

export default config;
