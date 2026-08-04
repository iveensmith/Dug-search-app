// Where a freshly authenticated user lands, by role — shared by login and
// reset-password (both sign the user in directly on success).
export const HOME_BY_ROLE: Record<string, string> = {
  PHARMACY_OWNER: '/pharmacy',
  ADMIN: '/admin',
  PHARMACIST: '/pharmacist',
  PATIENT: '/',
}

// Each role's own dashboard — shared by the header and the account page.
export const DASHBOARD_HREF: Record<string, string> = {
  PATIENT: '/search-history',
  PHARMACY_OWNER: '/pharmacy',
  PHARMACIST: '/pharmacist',
  ADMIN: '/admin',
}
export const DASHBOARD_LABEL: Record<string, string> = {
  PATIENT: 'Search history',
  PHARMACY_OWNER: 'Pharmacy dashboard',
  PHARMACIST: 'Pharmacist desk',
  ADMIN: 'Admin panel',
}

export type Portal = 'patient' | 'pharmacy'

/**
 * Which roles each login tab can sign in to. The tab is a hard filter, not
 * a hint: an email registered only as a patient must be rejected on the
 * pharmacy tab even when the password is right, so that whoever holds that
 * email has to register a separate pharmacy account (the schema allows it —
 * User is unique on [email, role], not on email alone).
 *
 * Pharmacists and admins sit on the pharmacy side because that tab is the
 * staff entrance and their accounts are only ever created by an admin,
 * never self-registered — so there is no patient/staff collision to guard
 * against, and they'd otherwise have no way in at all.
 */
export const PORTAL_ROLES: Record<Portal, readonly string[]> = {
  patient: ['PATIENT'],
  pharmacy: ['PHARMACY_OWNER', 'PHARMACIST', 'ADMIN'],
}

export const ROLE_LABEL: Record<string, string> = {
  PATIENT: 'Patient',
  PHARMACY_OWNER: 'Pharmacy owner',
  PHARMACIST: 'Pharmacist',
  ADMIN: 'Admin',
}
