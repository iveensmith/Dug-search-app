import type { Metadata } from 'next'

/**
 * The page itself is a client component and cannot export metadata, so it
 * lives here. Without it this route inherits the root description — which
 * describes searching for medicine, and is wrong for every page that does
 * something else.
 */
export const metadata: Metadata = {
  title: 'Log in',
  description:
    "Sign in to MediQuest as a patient, or as a pharmacy owner to manage your outlet's stock.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
