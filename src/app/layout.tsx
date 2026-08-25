import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import TabBar from "@/components/ui/TabBar";
import AppAlive from "@/components/ui/AppAlive";

// Body and UI text — nav, buttons, labels, paragraphs. `display: swap` so
// text is readable in the fallback while the file loads rather than
// invisible — this is a page people open to find medicine, sometimes on a
// slow connection. Inter is a variable font on Google Fonts, so one file
// covers every weight the app uses instead of five separate downloads.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Editorial headlines only — hero copy, page titles, section headings.
// Fraunces carries a real italic, which is the point: headings pair a
// roman clause with an italic word for emphasis, the way a magazine
// headline does, rather than leaning on bold weight alone. Also variable,
// so roman and italic share one file per axis.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// Neither of the above has a monospace companion, and four places
// genuinely need one: API keys, webhook payloads, event names and the
// temporary password an admin reads out. Those are strings people
// transcribe by hand, where a proportional face makes 0 and O, and 1 and
// l, the same shape.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
 * Counts what kind of browser each visit arrives on. Shows nothing.
 *
 * This used to put a red banner in front of anyone it judged too old, and
 * that judgement was wrong twice: first it tested CSS color-mix, which
 * Tailwind already guards with an @supports fallback, so it fired on
 * phones where the app rendered perfectly; then it tested syntax with
 * `new Function`, which the CSP blocks, so it fired on absolutely
 * everyone. Both times it told people with a working app that it would
 * not work.
 *
 * The banner is gone rather than fixed a third time. It was answering a
 * question the app no longer has: since the bundle is compiled to ES2018
 * and the stylesheet no longer depends on cascade layers, old phones run
 * this. Telling them otherwise was the only thing left that was broken.
 *
 * What remains is the count, which is invisible and still worth having —
 * it is the number that says whether supporting anything older is worth
 * doing. See BROWSERS.md.
 *
 * Still ES5, and still styled by nothing, because it has to run on the
 * browsers it is counting.
 */
const OLD_BROWSER_SCRIPT = `
(function () {
  try {
    // Two small APIs the bundle calls that predate nothing else in it.
    // Cheaper to fill in than to hunt down in a dependency, and both are
    // exactly specified, so a four-line version is the real behaviour.
    if (!Object.hasOwn) {
      Object.hasOwn = function (o, k) {
        return Object.prototype.hasOwnProperty.call(Object(o), k);
      };
    }
    if (!Array.prototype.at) {
      Array.prototype.at = function (n) {
        n = Math.trunc(n) || 0;
        if (n < 0) n += this.length;
        return n < 0 || n >= this.length ? undefined : this[n];
      };
    }

    // Kept only to tell "works fully" from "works, minus some colour" in
    // the numbers. Nothing is shown to the visitor for this one.
    var cssOk = true;
    if (window.CSS && CSS.supports) {
      cssOk = CSS.supports('color', 'color-mix(in oklab, red, blue)');
    }

    // Reported for every visit, including the ones that work — a count of
    // failures with no denominator cannot say whether it is 1% or 30%.
    // Once per session, so a person browsing ten pages counts once.
    var report = function (bucket) {
      var sent = false;
      try {
        sent = !!sessionStorage.getItem('mq-browser-reported');
        if (!sent) sessionStorage.setItem('mq-browser-reported', '1');
      } catch (e) {}
      if (sent) return;
      var body = '{"bucket":"' + bucket + '"}';
      var posted = false;
      try {
        if (navigator.sendBeacon) {
          posted = navigator.sendBeacon('/api/telemetry/browser',
            new Blob([body], { type: 'application/json' }));
        }
      } catch (e) {}
      if (!posted) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/telemetry/browser', true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(body);
        } catch (e) {}
      }
    };

    // Decided after the load event, not on a timer from the start: load
    // waits for the bundle to finish downloading, which on a slow
    // connection is the long part. Once it has fired the script has either
    // parsed or it has not, and a couple of seconds is plenty to tell
    // which — so a browser on a bad connection is not accused of being old.
    var decide = function () {
      report(window.__mqAlive ? (cssOk ? 'supported' : 'css_too_old') : 'js_too_old');
    };
    var armed = false;
    var arm = function () { if (armed) return; armed = true; setTimeout(decide, 2500); };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm);
    // If the load event never fires at all, decide anyway rather than never.
    setTimeout(arm, 25000);
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
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: OLD_BROWSER_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <TabBar />
        {/* Sets window.__mqAlive; the head script reads it. */}
        <AppAlive />
      </body>
    </html>
  );
}
