import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './db'
import type { Role } from '../generated/prisma/enums'

export const SESSION_COOKIE = 'df_session'
const SESSION_DAYS = 7

function secretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-only-secret-change-in-production')
}

export type Session = { userId: string; role: Role }

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey())
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' })
}

export async function getSession(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (!payload.sub || typeof payload.role !== 'string') return null
    return { userId: payload.sub, role: payload.role as Role }
  } catch {
    return null
  }
}

/**
 * Returns the session, or a ready-to-return 401/403 response.
 * Usage: const s = await requireSession(req, ['PHARMACY_OWNER'])
 *        if (s instanceof NextResponse) return s
 */
export async function requireSession(
  req: NextRequest,
  roles?: Role[],
): Promise<Session | NextResponse> {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }
  if (roles && !roles.includes(session.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  return session
}

/** Nigerian numbers: "0803 123 4567" → "+2348031234567"; leaves other formats alone. */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (/^0\d{10}$/.test(cleaned)) return `+234${cleaned.slice(1)}`
  return cleaned
}

/**
 * Looks up every account matching an email (case-insensitive) or phone.
 * Email/phone are only unique per-role (see schema) — the same identifier
 * can have one PATIENT account and a separate PHARMACY_OWNER account, so
 * this can return more than one row. Login tries the password against each
 * candidate rather than trusting a role hint, so it keeps working
 * regardless of which portal tab a returning user happens to have open.
 */
export async function findUsersByIdentifier(identifier: string) {
  const id = identifier.trim()
  if (id.includes('@')) {
    return prisma.user.findMany({ where: { email: id.toLowerCase() } })
  }
  return prisma.user.findMany({ where: { phone: normalizePhone(id) } })
}
