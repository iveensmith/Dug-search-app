/**
 * Ends the session and leaves for the landing page.
 *
 * Deliberately a hard navigation rather than router.push. A client-side
 * push keeps the signed-in page mounted while the transition resolves — so
 * you carry on looking at the pharmacy dashboard for a beat after clicking
 * Log out — and it keeps that page's cached payload, so the Back button
 * brings the shell straight back on a shared phone. location.replace
 * throws away the router cache and the React tree, and replaces the
 * history entry so there is nothing to go back to.
 *
 * Shared by every header that offers a Log out, so they all behave the
 * same way.
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Leaving anyway: staying put with no feedback is worse than landing
    // on a home page that still shows you as signed in, which at least
    // reflects that the sign-out didn't reach the server.
  }
  window.location.replace('/')
}
