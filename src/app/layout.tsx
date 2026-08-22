import type { Metadata, Viewport } from "next";
import { Geist_Mono, Open_Sans } from "next/font/google";
import "./globals.css";
import TabBar from "@/components/ui/TabBar";

// The app's one typeface. `display: swap` so text is readable in the
// fallback while the file loads rather than invisible — this is a page
// people open to find medicine, sometimes on a slow connection.
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
});

// Open Sans has no monospace companion, and four places genuinely need
// one: API keys, webhook payloads, event names and the temporary password
// an admin reads out. Those are strings people transcribe by hand, where
// a proportional face makes 0 and O, and 1 and l, the same shape. So the
// mono stays a mono; everything else is Open Sans.
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
