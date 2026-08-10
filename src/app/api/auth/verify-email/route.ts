import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { hashToken, issueVerifyUrl, resendWaitMs } from '@/lib/emailVerification'
import { sendVerifyEmail } from '@/lib/mail'

/**
 * Consumes a verification link, or sends a fresh one.
 *
 *   POST { token }  confirm an address
 *   POST { }        resend to the signed-in account
 *
 * The token is single-use: it is cleared in the same write that records
 * the verification, so a link still sitting in a mailbox months later is
 * worth nothing.
 */
const bodySchema = z.object({ token: z.string().min(10).max(200).optional() })

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { token } = parsed.data

  if (token) {
    const user = await prisma.user.findUnique({
      where: { emailVerifyTokenHash: hashToken(token) },
      select: { id: true, emailVerifyExpiresAt: true, emailVerifiedAt: true },
    })
    if (!user || !user.emailVerifyExpiresAt || user.emailVerifyExpiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This link is invalid or has expired — sign in and ask for a new one.' },
        { status: 400 },
      )
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Keeps the original timestamp if somehow already verified, so a
        // double-click cannot rewrite when it happened.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        // Clearing the token in the same write is what makes it single-use.
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    })
    return NextResponse.json({ verified: true })
  }

  // Resend. Requires a session, so this can never be used to discover
  // whether an address is registered — the only address it will ever mail
  // is the one on the account already holding the cookie.
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, emailVerifiedAt: true, emailVerifyExpiresAt: true },
  })
  if (!user?.email) return NextResponse.json({ error: 'No email on this account' }, { status: 400 })
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true })

  const wait = resendWaitMs(user.emailVerifyExpiresAt)
  if (wait > 0) {
    return NextResponse.json(
      { error: `Just sent one — check your inbox, or try again in ${Math.ceil(wait / 1000)}s.` },
      { status: 429 },
    )
  }

  await sendVerifyEmail(user.email, await issueVerifyUrl(user.id, req.nextUrl.origin))
  return NextResponse.json({ sent: true })
}
