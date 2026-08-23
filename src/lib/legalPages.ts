/**
 * The three policy pages, in one place.
 *
 * Its own module rather than living next to either of the things that
 * need it: SiteFooter renders the list, and LegalPage renders the same
 * list as "the other policies" — and LegalPage already imports
 * SiteFooter, so putting the list in either one makes a cycle.
 */
export const LEGAL_PAGES = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/data-handling', label: 'Data Handling' },
  { href: '/terms', label: 'Terms of Service' },
] as const
