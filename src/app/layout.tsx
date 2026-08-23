import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import TabBar from "@/components/ui/TabBar";

// The app's one typeface. `display: swap` so text is readable in the
// fallback while the file loads rather than invisible — this is a page
// people open to find medicine, sometimes on a slow connection.
//
// Poppins is not a variable font on Google Fonts, so unlike the Open Sans
// it replaced, every weight is a separate file and has to be named. These
// five are the ones the app actually uses — 400 body, 500/600 for labels
// and buttons, 700 headings, 800 the two places that go heavier. Adding a
// weight here costs another download, so only add one that gets used.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Poppins has no monospace companion, and four places genuinely need
// one: API keys, webhook payloads, event names and the temporary password
// an admin reads out. Those are strings people transcribe by hand, where
// a proportional face makes 0 and O, and 1 and l, the same shape. So the
// mono stays a mono; everything else is Poppins.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // `template` wraps whatever a route sets, so a page only has to name
  // itself: "Log in" becomes "Log in · MediQuest". `default` covers the
  // home page and anything that sets no title of its own.
  title: {
    default: "MediQuest — find medicine in stock near you",
    template: "%s · MediQuest",
  },
  description:
    "Find which pharmacies near you in Nigeria have your medicine in stock, with directions and phone numbers.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
  ],
};

// Runs before paint so the right theme applies immediately — no flash of
// the wrong theme while React hydrates. Kept tiny and dependency-free.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

/**
 * Says so when the browser is too old to run this app, instead of leaving
 * a page that looks fine and does nothing.
 *
 * Next server-renders even client components, so an old phone still gets
 * readable HTML — then the bundle fails to parse and React never
 * hydrates. Search does nothing, the pickers do nothing, and there is no
 * clue why. That is the worst version of this: a patient looking for
 * medicine, on a page that appears to be working.
 *
 * The floor is set by the two things the app is built on, not by taste.
 * Tailwind v4 emits `@property` and `color-mix()` (Safari 16.4 and 16.2),
 * and the JS bundle ships `?.` and `??` (Safari 13.1) — see the notes in
 * BROWSERS.md. An iPhone 6 stops at iOS 12, so it clears none of them.
 *
 * Written in ES5 on purpose — no const, arrow, or template literal —
 * because a browser that cannot parse this script cannot be warned by it.
 * Styled inline for the same reason: on these browsers the stylesheet is
 * part of what is broken.
 */
const OLD_BROWSER_SCRIPT = `
(function () {
  try {
    var ok = true;
    try { new Function('var o={};return o?.a'); } catch (e) { ok = false; }
    if (ok && window.CSS && CSS.supports) {
      if (!CSS.supports('color', 'color-mix(in oklab, red, blue)')) ok = false;
    }
    if (ok) return;
    var show = function () {
      if (!document.body || document.getElementById('mq-old-browser')) return;
      var bar = document.createElement('div');
      bar.id = 'mq-old-browser';
      bar.setAttribute('role', 'alert');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;'
        + 'background:#7f1d1d;color:#fff;padding:14px 16px;'
        + 'font:600 15px/1.45 -apple-system,Helvetica,Arial,sans-serif;text-align:left';
      bar.innerHTML = '<strong style="display:block;font-size:16px;margin-bottom:4px">'
        + 'This browser is too old for MediQuest</strong>'
        + 'Searching for medicine will not work on this device. Please open '
        + 'MediQuest on a newer phone or a computer. '
        + '<a href="mailto:hello@mediquest.ng" style="color:#fff;text-decoration:underline">'
        + 'hello@mediquest.ng</a>';
      // Appended to <html>, not <body>. Inserted at DOMContentLoaded it
      // would land before React hydrates, and React reconciling <body>
      // treats an unexpected first child as a mismatch: it throws, rebuilds
      // the tree, and the warning disappears — on exactly the browsers new
      // enough to run React but too old for the stylesheet. Outside <body>
      // React never looks at it.
      document.documentElement.appendChild(bar);
      // Measured after insertion, not guessed: this text wraps to two
      // lines on a wide phone and four on a narrow one, and a fixed guess
      // left the banner sitting on top of the header.
      document.documentElement.style.paddingTop = bar.offsetHeight + 'px';
    };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: OLD_BROWSER_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
