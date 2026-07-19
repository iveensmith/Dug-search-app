// Where a freshly authenticated user lands, by role — shared by login and
// reset-password (both sign the user in directly on success).
export const HOME_BY_ROLE: Record<string, string> = {
  PHARMACY_OWNER: '/pharmacy',
  ADMIN: '/admin',
  PHARMACIST: '/pharmacist',
  PATIENT: '/',
}
