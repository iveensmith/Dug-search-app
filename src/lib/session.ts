import { jwtVerify } from 'jose'
import type { Role } from '../generated/prisma/enums'

/**
 * Session cookie reading, with no database or bcrypt behind it.
 *
 * Split out of lib/auth so proxy.ts and server components can check who is
 * signed in without dragging Prisma along — the proxy runs in front of
 * every matched request and has no business opening a database client.
 */
export const SESSION_COOKIE = 'df_session'

export type Session = { userId: string; role: Role }

/**
 * The value this used to fall back to. It is published in this repository
 * and in .env.example, which is exactly why it must never sign anything
 * real.
 */
const DEV_ONLY_SECRET = 'dev-only-secret-change-in-production'

/**
 * The key session cookies are signed and verified with.
 *
 * This used to fall back to DEV_ONLY_SECRET whenever JWT_SECRET was unset,
 * silently and in every environment. In a public repository that is not a
 * default, it is a published signing key: anyone could read it here, mint
 * a token carrying `role: "ADMIN"` and any user id, and be an
 * administrator of the deployment. Nothing would look wrong in a log —
 * the token verifies, because it was signed with the real key.
 *
 * So in production there is no fallback. A deployment without a real
 * secret fails loudly on the first session it touches, which is a bad
 * afternoon; the alternative is an app that appears to work while being
 * open to anybody who can read GitHub.
 *
 * Thrown lazily rather than at import: verifySessionToken returns early
 * when there is no cookie, so prerendering pages at build time never
 * reaches this.
 */
export function secretKey() {
  const secret = process.env.JWT_SECRET

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret === DEV_ONLY_SECRET || secret.length < 32) {
      throw new Error(
        'JWT_SECRET is missing, too short, or still the development value. ' +
          'Session cookies would be signed with a key published in this repository, ' +
          'so anyone could forge an admin session. Set a real one in the hosting ' +
          "provider's environment variables: " +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      )
    }
  }

  return new TextEncoder().encode(secret ?? DEV_ONLY_SECRET)
}

/** Verified session from a raw cookie value, or null if absent/invalid. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (!payload.sub || typeof payload.role !== 'string') return null
    return { userId: payload.sub, role: payload.role as Role }
  } catch {
    return null
  }
}
