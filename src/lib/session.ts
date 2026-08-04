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

function secretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-only-secret-change-in-production')
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
