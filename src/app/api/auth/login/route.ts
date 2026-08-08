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

const NO_ACCOUNT_MESSAGE = {
  pharmacy:
    'No pharmacy account is registered with that email. Register your pharmacy to create one — you can use the same email as your patient account.',
  patient: 'No patient account is registered with that email. Create one — it only takes a minute.',
} as const

/**
 * The one answer given to a wrong password, a locked account, and an
 * attempt made too soon after the last one.
 *
 * They have to be indistinguishable. "Too many attempts" confirms to
 * whoever is guessing both that the account is real and that their
 * guesses are landing somewhere worth guessing. The person who owns the
 * account learns about the lockout by email instead — a channel only they
 * can read.
 */
const WRONG_CREDENTIALS_MESSAGE = 'Wrong email/phone or password'

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
    // Same reply as a wrong password. See WRONG_CREDENTIALS_MESSAGE.
    return NextResponse.json({ error: WRONG_CREDENTIALS_MESSAGE }, { status: 401 })
  }

  // Email/phone are unique per-role, not globally, so one identifier can
  // match a patient account and a separate pharmacy account. The tab the
  // user picked decides which of those they are allowed to open: a patient
  // account is not a pharmacy account, whatever its password is.
  const allowed = PORTAL_ROLES[portal]
  const candidates = (await findUsersByIdentifier(identifier)).filter((u) =>
    allowed.includes(u.role),
  )

  // Deliberately distinguished from a wrong password: the whole point is to
  // tell someone that this side of the app has no account for them yet, so
  // they know to register rather than keep retrying the password. It does
  // reveal that no account exists on this side for that email — the sign-up
  // form already gives that away by rejecting duplicates. It still never
  // says anything about the *other* side.
  if (candidates.length === 0) {
    // Still counted. Guessing at an address with no account here must cost
    // the same as guessing at one that has.
    await recordFailure(key)
    return NextResponse.json(
      { error: NO_ACCOUNT_MESSAGE[portal], needsAccount: portal },
      { status: 401 },
    )
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
    return NextResponse.json({ error: WRONG_CREDENTIALS_MESSAGE }, { status: 401 })
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
