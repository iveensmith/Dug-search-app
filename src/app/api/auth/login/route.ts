import { NextRequest, NextResponse } from 'next/server'
import {
  findUsersByIdentifier,
  hashPassword,
  needsRehash,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  INVALID_INPUT_MESSAGE,
  loginSchema,
  logValidationFailure,
  readJsonBody,
} from '@/lib/authValidation'
import {
  accountIsBlocked,
  accountKey,
  clearFailures,
  clientIp,
  consumeIpRequest,
  LOCKOUT_MS,
  pruneOccasionally,
  recordFailure,
} from '@/lib/loginThrottle'
import { sendAccountLockedEmail } from '@/lib/mail'
import { issueResetUrl } from '@/lib/passwordReset'
import { PORTAL_ROLES } from '@/lib/roles'

/**
 * The only answer this route gives to a failed sign-in, whatever the
 * reason: no account at all, an account on the other portal, the wrong
 * password, a locked account, or an attempt made too soon after the last
 * one. One string, one status code, one response body.
 *
 * Each of those distinctions is worth something to whoever is guessing.
 * "No account with that email" sorts a stolen address list into real and
 * junk without a single password being tried. "Too many attempts"
 * confirms both that the account exists and that the guessing is being
 * noticed, which is the cue to slow down and keep going elsewhere.
 *
 * The person who owns the account still gets told when it locks — by
 * email, a channel only they can read.
 */
const SIGN_IN_FAILED_MESSAGE = 'Incorrect email or password'

export async function POST(req: NextRequest) {
  // Volume first, before parsing or touching a password hash. This is the
  // cheap check and it applies to every caller regardless of what they
  // sent.
  const ip = clientIp(req)
  const rate = await consumeIpRequest(ip)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-in attempts from this device. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    )
  }

  // Every rule runs here, on the body as it arrived. What the form did
  // before sending it is not evidence of anything.
  const body = await readJsonBody(req)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    logValidationFailure(
      'auth/login',
      req,
      parsed.error,
      typeof (body as { identifier?: unknown })?.identifier === 'string'
        ? (body as { identifier: string }).identifier
        : undefined,
    )
    // One reply for every shape of bad input, so probing the endpoint
    // tells you nothing about which field it disliked.
    return NextResponse.json({ error: INVALID_INPUT_MESSAGE }, { status: 400 })
  }
  const { identifier, password, portal } = parsed.data

  // Keyed by what was typed, not by a user id, so an address with no
  // account is throttled exactly like one that has an account. If it were
  // not, "this one answers instantly" would itself be an answer.
  const key = accountKey(identifier, portal)
  if (await accountIsBlocked(key)) {
    // Same reply as a wrong password. See SIGN_IN_FAILED_MESSAGE.
    return NextResponse.json({ error: SIGN_IN_FAILED_MESSAGE }, { status: 401 })
  }

  // Email/phone are unique per-role, not globally, so one identifier can
  // match a patient account and a separate pharmacy account. The tab the
  // user picked decides which of those they are allowed to open: a patient
  // account is not a pharmacy account, whatever its password is.
  const allowed = PORTAL_ROLES[portal]
  const candidates = (await findUsersByIdentifier(identifier)).filter((u) =>
    allowed.includes(u.role),
  )

  // No account on this portal reads exactly like a wrong password. This
  // used to say so explicitly, to point a pharmacist whose email is only a
  // patient account at the right sign-up form; that hint also told anyone
  // holding a list of addresses which ones are real, for free. The sign-up
  // routes are linked permanently from the login page instead, where they
  // are visible to everyone and therefore tell no one anything.
  if (candidates.length === 0) {
    // Still counted. Guessing at an address with no account here must cost
    // the same as guessing at one that has — otherwise the *speed* of the
    // answer becomes the thing that gives it away.
    await recordFailure(key)
    return NextResponse.json({ error: SIGN_IN_FAILED_MESSAGE }, { status: 401 })
  }

  let user = null
  for (const candidate of candidates) {
    if (await verifyPassword(password, candidate.passwordHash)) {
      user = candidate
      break
    }
  }
  if (!user) {
    const { justLocked } = await recordFailure(key)
    if (justLocked) await notifyLockedOut(candidates, req.nextUrl.origin)
    return NextResponse.json({ error: SIGN_IN_FAILED_MESSAGE }, { status: 401 })
  }

  // Signing in clears the history — a run of failures that ended in the
  // right password was someone remembering it, not an attack.
  await clearFailures(key)
  void pruneOccasionally()

  // The one moment the plaintext is in hand and known to be correct, and
  // so the only moment an old hash can be replaced with a current one.
  // Raising the work factor does nothing for accounts that already exist
  // until each of them signs in once; this is how they get there, without
  // anyone being asked to do anything.
  if (needsRehash(user.passwordHash)) {
    await upgradeHash(user.id, password)
  }

  const res = NextResponse.json({
    user: { id: user.id, role: user.role, displayName: user.displayName },
  })
  setSessionCookie(res, await signSession({ userId: user.id, role: user.role }))
  return res
}

/**
 * Rewrites one account's password hash at the current work factor.
 *
 * Guarded so it can never cost anyone their sign-in. They typed the right
 * password; the session is already earned. If the write fails — a dropped
 * connection, a pooler hiccup — the old hash stays, which still works,
 * and the next sign-in tries again.
 */
async function upgradeHash(userId: string, password: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password) },
    })
  } catch (e) {
    // No password in the message — only that one row could not be rewritten.
    console.error('[auth] could not upgrade a password hash', { userId, error: String(e) })
  }
}

/**
 * Emails the account owner that sign-ins have been suspended, with a link
 * that lets them take the account back immediately.
 *
 * Sent once per lockout, not once per guess — the throttle's notifiedAt
 * flag decides, because otherwise a sustained attack would turn this into
 * a way of mailbombing whoever owns the address.
 *
 * Never allowed to affect the reply. A mail provider being down is not a
 * reason to answer this request differently, and any difference would be
 * exactly the signal the generic message exists to withhold.
 */
async function notifyLockedOut(
  candidates: { id: string; email: string | null }[],
  origin: string,
): Promise<void> {
  const minutes = Math.round(LOCKOUT_MS / 60_000)
  for (const candidate of candidates) {
    if (!candidate.email) continue
    try {
      await sendAccountLockedEmail(
        candidate.email,
        minutes,
        await issueResetUrl(candidate.id, origin),
      )
    } catch (e) {
      console.error('[auth] could not send the account-locked notice', e)
    }
  }
}
