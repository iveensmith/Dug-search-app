import type { Metadata } from 'next'

/**
 * The page itself is a client component and cannot export metadata, so it
 * lives here. Without it this route inherits the root description — which
 * describes searching for medicine, and is wrong for every page that does
 * something else.
 */
export const metadata: Metadata = {
  title: 'Reset your password',
  description:
    'Request a link to set a new password for your MediQuest account.',
  // Behind a sign-in, so there is nothing here for a crawler to index.
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
