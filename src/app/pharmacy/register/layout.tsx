import type { Metadata } from 'next'

/**
 * The page itself is a client component and cannot export metadata, so it
 * lives here. Without it this route inherits the root description — which
 * describes searching for medicine, and is wrong for every page that does
 * something else.
 */
export const metadata: Metadata = {
  title: 'Add your pharmacy outlet',
  description:
    'List your PCN-licensed pharmacy on MediQuest so patients nearby can find what you have in stock.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
