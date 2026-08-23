import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/mail'
import { issueResetUrl } from '@/lib/passwordReset'
import { INVALID_INPUT_MESSAGE } from '@/lib/authValidation'
import { consumeWindow } from '@/lib/rateLimit'
import { clientIp } from '@/lib/loginThrottle'

const bodySchema = z.object({ identifier: z.string().min(3).max(200) })

// Always responds { ok: true } regardless of whether the account exists (or
// has an email on file) — avoids leaking which identifiers are registered.
//
// Email/phone are only unique per-role, so the same identifier can match
// more than one account (e.g. a patient account and a pharmacy-owner
// account) — reset every matching account and email each one separately.
export async function POST(req: NextRequest) {
  // The only unauthenticated route that sends mail to an address the
  // caller names. Unthrottled it is two things: a way to bomb a real
  // person's inbox, and a way to burn the Resend quota — after which the
  // app stops delivering the verification mail everyone else needs.
  //
  // Still { ok: true } when it trips, for the same reason the rest of the
  // route is: a different answer here would say "this identifier is worth
  // rate limiting", which is the leak the route exists to avoid.
  const limit = await consumeWindow(`forgot:${clientIp(req)}`, 5, 60 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json({ ok: true })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    // Same generic reply as the other auth routes. Everything past this
    // point already answers { ok: true } whether or not the account
    // exists, so this is the only line that could have said otherwise.
    return NextResponse.json({ error: INVALID_INPUT_MESSAGE }, { status: 400 })
  }

  const id = parsed.data.identifier.trim()
  const users = await prisma.user.findMany({
    where: id.includes('@') ? { email: id.toLowerCase() } : { phone: normalizePhone(id) },
  })

  for (const user of users) {
    if (!user.email) continue
    await sendPasswordResetEmail(user.email, await issueResetUrl(user.id, req.nextUrl.origin))
  }

  return NextResponse.json({ ok: true })
}
