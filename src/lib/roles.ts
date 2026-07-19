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

export const ROLE_LABEL: Record<string, string> = {
  PATIENT: 'Patient',
  PHARMACY_OWNER: 'Pharmacy owner',
  PHARMACIST: 'Pharmacist',
  ADMIN: 'Admin',
}
